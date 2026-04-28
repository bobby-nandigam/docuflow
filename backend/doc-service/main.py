"""
DocuFlow Document Service
- Upload, download, version documents
- Folder/space management
- Permission checks
- Event publishing to Kafka
"""

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncpg, redis.asyncio as aioredis, aioboto3
from aiokafka import AIOKafkaProducer
from contextlib import asynccontextmanager
import uuid, json, hashlib, mimetypes, os
from datetime import datetime, timezone

DB_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_BUCKET = os.getenv("S3_BUCKET", "docuflow")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "docuflow")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "secret123")

MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DB_URL, min_size=5, max_size=30)
    app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    app.state.kafka = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BROKERS,
        value_serializer=lambda v: json.dumps(v).encode()
    )
    await app.state.kafka.start()
    yield
    await app.state.db.close()
    await app.state.redis.aclose()
    await app.state.kafka.stop()

app = FastAPI(title="DocuFlow Document Service", version="1.0.0", lifespan=lifespan)

# ─── HELPERS ──────────────────────────────────────────────────

async def get_tenant_and_user(x_tenant_id: str, x_user_id: str, x_user_role: str):
    """Injected by API gateway from JWT claims"""
    return {"tenant_id": x_tenant_id, "user_id": x_user_id, "role": x_user_role}

async def publish_event(topic: str, event: dict):
    await app.state.kafka.send_and_wait(topic, event)

def s3_key(tenant_id: str, doc_id: str, version: int, filename: str) -> str:
    return f"tenants/{tenant_id}/docs/{doc_id}/v{version}/{filename}"

def compute_checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

async def check_permission(conn, doc_id: str, user_id: str, tenant_id: str, required: str = "view") -> bool:
    perms = {"view": 1, "comment": 2, "edit": 3, "manage": 4, "owner": 5}
    doc = await conn.fetchrow(
        "SELECT created_by, space_id FROM documents WHERE id=$1 AND tenant_id=$2",
        doc_id, tenant_id
    )
    if not doc:
        return False
    if str(doc["created_by"]) == user_id:
        return True  # Owner always has access

    perm = await conn.fetchrow(
        """SELECT permission FROM document_permissions
           WHERE document_id=$1 AND principal_type='user' AND principal_id=$2
           AND (expires_at IS NULL OR expires_at > now())""",
        doc_id, user_id
    )
    if perm and perms.get(perm["permission"], 0) >= perms.get(required, 1):
        return True

    # Check space-level access
    if doc["space_id"]:
        space_perm = await conn.fetchrow(
            "SELECT role FROM space_members WHERE space_id=$1 AND user_id=$2",
            doc["space_id"], user_id
        )
        if space_perm:
            return True

    return False

# ─── UPLOAD ───────────────────────────────────────────────────

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    space_id: Optional[str] = Form(None),
    parent_id: Optional[str] = Form(None),
    x_tenant_id: str = None,
    x_user_id: str = None,
    x_user_role: str = None,
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 500MB)")

    doc_id = str(uuid.uuid4())
    checksum = compute_checksum(content)
    mime = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    storage_key = s3_key(x_tenant_id, doc_id, 1, file.filename)

    # Upload to S3/MinIO
    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
    ) as s3:
        await s3.put_object(
            Bucket=S3_BUCKET,
            Key=storage_key,
            Body=content,
            ContentType=mime,
            ServerSideEncryption="AES256",
            Metadata={
                "tenant-id": x_tenant_id,
                "uploader-id": x_user_id,
                "original-filename": file.filename,
            }
        )

    # Save to database
    pool = app.state.db
    async with pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{x_tenant_id}'")
        doc = await conn.fetchrow(
            """INSERT INTO documents
               (id, tenant_id, space_id, parent_id, name, mime_type, extension,
                storage_key, storage_size, checksum, created_by, updated_by, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,'processing')
               RETURNING *""",
            doc_id, x_tenant_id, space_id, parent_id,
            file.filename, mime, ext, storage_key,
            len(content), checksum, x_user_id
        )

        # Save version
        await conn.execute(
            """INSERT INTO document_versions
               (document_id, version, storage_key, size, checksum, created_by)
               VALUES ($1, 1, $2, $3, $4, $5)""",
            doc_id, storage_key, len(content), checksum, x_user_id
        )

        # Audit log
        await conn.execute(
            """INSERT INTO audit_logs (tenant_id, user_id, action, resource, resource_id, metadata)
               VALUES ($1, $2, 'document.upload', 'document', $3, $4)""",
            x_tenant_id, x_user_id, doc_id,
            json.dumps({"filename": file.filename, "size": len(content), "mime": mime})
        )

    # Publish event for AI processing
    await publish_event("document.uploaded", {
        "event": "document.uploaded",
        "tenant_id": x_tenant_id,
        "user_id": x_user_id,
        "document_id": doc_id,
        "filename": file.filename,
        "storage_key": storage_key,
        "mime_type": mime,
        "size": len(content),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    # Invalidate cache
    await app.state.redis.delete(f"docs:list:{x_tenant_id}:{space_id or 'root'}")

    return {
        "id": doc_id,
        "name": file.filename,
        "status": "processing",
        "mime_type": mime,
        "size": len(content),
        "message": "Document uploaded. AI processing started."
    }

# ─── LIST & GET ───────────────────────────────────────────────

@app.get("/documents")
async def list_documents(
    space_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    search: Optional[str] = None,
    tags: Optional[str] = None,
    category: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
    sort: str = "updated_at",
    order: str = "desc",
    x_tenant_id: str = None,
    x_user_id: str = None,
):
    cache_key = f"docs:list:{x_tenant_id}:{space_id}:{parent_id}:{search}:{page}"
    if not search:
        cached = await app.state.redis.get(cache_key)
        if cached:
            return json.loads(cached)

    pool = app.state.db
    async with pool.acquire() as conn:
        await conn.execute(f"SET app.tenant_id = '{x_tenant_id}'")

        where_parts = ["d.tenant_id = $1", "d.status = 'active'", "d.is_latest = true"]
        params = [x_tenant_id]
        idx = 2

        if space_id:
            where_parts.append(f"d.space_id = ${idx}")
            params.append(space_id); idx += 1
        if parent_id:
            where_parts.append(f"d.parent_id = ${idx}")
            params.append(parent_id); idx += 1
        else:
            where_parts.append("d.parent_id IS NULL")

        if search:
            where_parts.append(
                f"to_tsvector('english', coalesce(d.name,'') || ' ' || coalesce(d.ai_summary,'')) "
                f"@@ plainto_tsquery('english', ${idx})"
            )
            params.append(search); idx += 1

        if tags:
            tag_list = tags.split(",")
            where_parts.append(f"d.ai_tags && ${idx}::text[]")
            params.append(tag_list); idx += 1

        if category:
            where_parts.append(f"d.ai_category = ${idx}")
            params.append(category); idx += 1

        sort_col = sort if sort in ("name","created_at","updated_at","storage_size") else "updated_at"
        order_dir = "DESC" if order.lower() == "desc" else "ASC"
        offset = (page - 1) * per_page

        query = f"""
            SELECT d.*, u.name as creator_name
            FROM documents d
            LEFT JOIN users u ON d.created_by = u.id
            WHERE {' AND '.join(where_parts)}
            ORDER BY d.{sort_col} {order_dir}
            LIMIT {per_page} OFFSET {offset}
        """
        rows = await conn.fetch(query, *params)
        total = await conn.fetchval(
            f"SELECT count(*) FROM documents d WHERE {' AND '.join(where_parts)}",
            *params
        )

    result = {
        "documents": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    }

    if not search:
        await app.state.redis.setex(cache_key, 60, json.dumps(result, default=str))

    return result

@app.get("/documents/{doc_id}")
async def get_document(doc_id: str, x_tenant_id: str = None, x_user_id: str = None):
    cache_key = f"doc:{doc_id}"
    cached = await app.state.redis.get(cache_key)
    if cached:
        return json.loads(cached)

    pool = app.state.db
    async with pool.acquire() as conn:
        if not await check_permission(conn, doc_id, x_user_id, x_tenant_id, "view"):
            raise HTTPException(403, "Access denied")

        doc = await conn.fetchrow(
            """SELECT d.*, u.name as creator_name,
               (SELECT count(*) FROM document_versions WHERE document_id=d.id) as version_count
               FROM documents d LEFT JOIN users u ON d.created_by=u.id
               WHERE d.id=$1 AND d.tenant_id=$2""",
            doc_id, x_tenant_id
        )
        if not doc:
            raise HTTPException(404, "Document not found")

        metadata = await conn.fetch(
            "SELECT key, value, source FROM document_metadata WHERE document_id=$1", doc_id
        )

        # Audit view
        await conn.execute(
            "INSERT INTO audit_logs (tenant_id,user_id,action,resource,resource_id) VALUES ($1,$2,'document.view','document',$3)",
            x_tenant_id, x_user_id, doc_id
        )

    result = {**dict(doc), "metadata": {m["key"]: m["value"] for m in metadata}}
    await app.state.redis.setex(cache_key, 300, json.dumps(result, default=str))
    return result

@app.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, x_tenant_id: str = None, x_user_id: str = None):
    pool = app.state.db
    async with pool.acquire() as conn:
        if not await check_permission(conn, doc_id, x_user_id, x_tenant_id, "view"):
            raise HTTPException(403, "Access denied")
        doc = await conn.fetchrow(
            "SELECT name, storage_key, mime_type FROM documents WHERE id=$1 AND tenant_id=$2",
            doc_id, x_tenant_id
        )
        if not doc:
            raise HTTPException(404)

        await conn.execute(
            "INSERT INTO audit_logs (tenant_id,user_id,action,resource,resource_id) VALUES ($1,$2,'document.download','document',$3)",
            x_tenant_id, x_user_id, doc_id
        )

    session = aioboto3.Session()
    async with session.client("s3", endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY, aws_secret_access_key=S3_SECRET_KEY) as s3:
        response = await s3.get_object(Bucket=S3_BUCKET, Key=doc["storage_key"])
        body = await response["Body"].read()

    return StreamingResponse(
        iter([body]),
        media_type=doc["mime_type"],
        headers={"Content-Disposition": f'attachment; filename="{doc["name"]}"'}
    )

@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, x_tenant_id: str = None, x_user_id: str = None):
    pool = app.state.db
    async with pool.acquire() as conn:
        if not await check_permission(conn, doc_id, x_user_id, x_tenant_id, "manage"):
            raise HTTPException(403, "Access denied")
        await conn.execute(
            "UPDATE documents SET status='trashed', trashed_at=now() WHERE id=$1 AND tenant_id=$2",
            doc_id, x_tenant_id
        )
    await app.state.redis.delete(f"doc:{doc_id}")
    await publish_event("document.deleted", {"document_id": doc_id, "tenant_id": x_tenant_id})
    return {"message": "Moved to trash"}

# ─── SPACES ───────────────────────────────────────────────────

@app.get("/spaces")
async def list_spaces(x_tenant_id: str = None, x_user_id: str = None):
    pool = app.state.db
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT s.*, sm.role as my_role,
               (SELECT count(*) FROM documents WHERE space_id=s.id AND status='active') as doc_count
               FROM spaces s
               JOIN space_members sm ON s.id=sm.space_id
               WHERE s.tenant_id=$1 AND sm.user_id=$2
               ORDER BY s.created_at DESC""",
            x_tenant_id, x_user_id
        )
    return [dict(r) for r in rows]

@app.post("/spaces")
async def create_space(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    icon: Optional[str] = Form("📁"),
    x_tenant_id: str = None,
    x_user_id: str = None,
):
    pool = app.state.db
    async with pool.acquire() as conn:
        space = await conn.fetchrow(
            """INSERT INTO spaces (tenant_id, name, description, icon, created_by)
               VALUES ($1,$2,$3,$4,$5) RETURNING *""",
            x_tenant_id, name, description, icon, x_user_id
        )
        await conn.execute(
            "INSERT INTO space_members (space_id, user_id, role) VALUES ($1,$2,'owner')",
            space["id"], x_user_id
        )
    return dict(space)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8020)
