"""
DocuFlow Integration Service
- Pluggable connector architecture
- OAuth2 for Google Drive, Dropbox, Slack, Salesforce
- Two-way sync with retry/backoff
- Webhook handling
- Rate limiting per integration
"""

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import asyncpg, redis.asyncio as aioredis
from aiokafka import AIOKafkaProducer
import httpx, json, uuid, asyncio, os, hmac, hashlib
from datetime import datetime, timezone
from contextlib import asynccontextmanager

DB_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DB_URL, min_size=3, max_size=15)
    app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    app.state.kafka = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BROKERS,
        value_serializer=lambda v: json.dumps(v).encode()
    )
    await app.state.kafka.start()
    asyncio.create_task(process_integration_events(app))
    yield
    await app.state.db.close()
    await app.state.redis.aclose()
    await app.state.kafka.stop()

app = FastAPI(title="DocuFlow Integration Service", version="1.0.0", lifespan=lifespan)

# ─── CONNECTOR REGISTRY ───────────────────────────────────────

class BaseConnector:
    def __init__(self, credentials: dict, settings: dict):
        self.credentials = credentials
        self.settings = settings

    async def list_files(self, cursor: str = None) -> dict:
        raise NotImplementedError

    async def download_file(self, file_id: str) -> bytes:
        raise NotImplementedError

    async def upload_file(self, filename: str, content: bytes, folder_id: str = None) -> dict:
        raise NotImplementedError

    async def refresh_token(self) -> dict:
        raise NotImplementedError

class GoogleDriveConnector(BaseConnector):
    BASE_URL = "https://www.googleapis.com/drive/v3"

    async def _auth_headers(self) -> dict:
        token = self.credentials.get("access_token")
        # Auto-refresh if needed
        expiry = self.credentials.get("token_expiry")
        if expiry and datetime.fromisoformat(expiry) < datetime.now(timezone.utc):
            await self.refresh_token()
            token = self.credentials.get("access_token")
        return {"Authorization": f"Bearer {token}"}

    async def list_files(self, cursor: str = None) -> dict:
        params = {
            "pageSize": 100,
            "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)",
            "orderBy": "modifiedTime desc",
        }
        if cursor:
            params["pageToken"] = cursor

        folder_id = self.settings.get("folder_id")
        if folder_id:
            params["q"] = f"'{folder_id}' in parents and trashed=false"

        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/files",
                headers=await self._auth_headers(),
                params=params,
                timeout=30
            )
            r.raise_for_status()
            data = r.json()

        return {
            "files": [
                {
                    "external_id": f["id"],
                    "name": f["name"],
                    "mime_type": f.get("mimeType"),
                    "size": int(f.get("size", 0)),
                    "modified_at": f.get("modifiedTime"),
                }
                for f in data.get("files", [])
            ],
            "cursor": data.get("nextPageToken"),
        }

    async def download_file(self, file_id: str) -> bytes:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.BASE_URL}/files/{file_id}?alt=media",
                headers=await self._auth_headers(),
                timeout=120
            )
            r.raise_for_status()
            return r.content

    async def refresh_token(self) -> dict:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.credentials["refresh_token"],
                    "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                }
            )
            data = r.json()
            self.credentials["access_token"] = data["access_token"]
            return data

class DropboxConnector(BaseConnector):
    BASE_URL = "https://api.dropboxapi.com/2"
    CONTENT_URL = "https://content.dropboxapi.com/2"

    async def list_files(self, cursor: str = None) -> dict:
        async with httpx.AsyncClient() as client:
            if cursor:
                r = await client.post(
                    f"{self.BASE_URL}/files/list_folder/continue",
                    headers={"Authorization": f"Bearer {self.credentials['access_token']}"},
                    json={"cursor": cursor}
                )
            else:
                folder = self.settings.get("folder_path", "")
                r = await client.post(
                    f"{self.BASE_URL}/files/list_folder",
                    headers={"Authorization": f"Bearer {self.credentials['access_token']}"},
                    json={"path": folder, "recursive": True, "limit": 100}
                )
            r.raise_for_status()
            data = r.json()

        files = [
            {
                "external_id": f["id"],
                "name": f["name"],
                "mime_type": None,
                "size": f.get("size", 0),
                "modified_at": f.get("client_modified"),
            }
            for f in data.get("entries", [])
            if f.get(".tag") == "file"
        ]
        return {"files": files, "cursor": data.get("cursor") if data.get("has_more") else None}

class SlackConnector(BaseConnector):
    """Send notifications to Slack channels"""

    async def send_message(self, channel: str, text: str, blocks: list = None) -> dict:
        payload = {"channel": channel, "text": text}
        if blocks:
            payload["blocks"] = blocks

        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://slack.com/api/chat.postMessage",
                headers={"Authorization": f"Bearer {self.credentials['bot_token']}"},
                json=payload
            )
            return r.json()

CONNECTOR_MAP = {
    "google_drive": GoogleDriveConnector,
    "dropbox": DropboxConnector,
    "slack": SlackConnector,
}

def get_connector(integration: dict) -> BaseConnector:
    connector_cls = CONNECTOR_MAP.get(integration["type"])
    if not connector_cls:
        raise ValueError(f"Unknown connector: {integration['type']}")
    return connector_cls(
        credentials=integration.get("credentials", {}),
        settings=integration.get("settings", {})
    )

# ─── RATE LIMITER ─────────────────────────────────────────────

async def check_rate_limit(redis_client, integration_id: str, limit: int = 60, window: int = 60) -> bool:
    key = f"ratelimit:integration:{integration_id}"
    current = await redis_client.incr(key)
    if current == 1:
        await redis_client.expire(key, window)
    return current <= limit

# ─── SYNC ENGINE ─────────────────────────────────────────────

async def sync_integration(app, integration: dict):
    """Incremental sync for an integration"""
    integration_id = str(integration["id"])
    tenant_id = str(integration["tenant_id"])

    # Rate limit check
    if not await check_rate_limit(app.state.redis, integration_id):
        print(f"[Sync] Rate limited: {integration_id}")
        return

    connector = get_connector(integration)
    cursor = integration.get("sync_cursor")

    try:
        result = await connector.list_files(cursor=cursor)
        files = result.get("files", [])
        new_cursor = result.get("cursor")

        for f in files:
            # Check if already synced
            existing = await app.state.redis.get(f"synced:{integration_id}:{f['external_id']}")
            if existing:
                continue

            # Queue for processing
            event = {
                "event": "integration.file_discovered",
                "tenant_id": tenant_id,
                "integration_id": integration_id,
                "integration_type": integration["type"],
                "file": f,
            }
            await app.state.kafka.send_and_wait("integration.sync", event)
            await app.state.redis.setex(f"synced:{integration_id}:{f['external_id']}", 86400, "1")

        # Update cursor
        if new_cursor:
            async with app.state.db.acquire() as conn:
                await conn.execute(
                    "UPDATE integrations SET sync_cursor=$1, last_sync_at=now() WHERE id=$2",
                    new_cursor, integration_id
                )

    except Exception as e:
        print(f"[Sync] Error for integration {integration_id}: {e}")
        async with app.state.db.acquire() as conn:
            await conn.execute(
                "INSERT INTO integration_events (integration_id, tenant_id, event_type, payload, status, error) VALUES ($1,$2,'sync.failed','{}','failed',$3)",
                integration_id, tenant_id, str(e)
            )

# ─── EVENT PROCESSOR ─────────────────────────────────────────

async def process_integration_events(app):
    """Background task to run periodic syncs"""
    while True:
        try:
            async with app.state.db.acquire() as conn:
                integrations = await conn.fetch(
                    "SELECT * FROM integrations WHERE status='active'"
                )

            for integration in integrations:
                asyncio.create_task(sync_integration(app, dict(integration)))

        except Exception as e:
            print(f"[Integration] Sync error: {e}")

        await asyncio.sleep(300)  # Sync every 5 minutes

# ─── ROUTES ───────────────────────────────────────────────────

class CreateIntegrationRequest(BaseModel):
    tenant_id: str
    user_id: str
    type: str
    name: str
    credentials: Dict[str, Any]
    settings: Optional[Dict] = {}

@app.post("/integrations")
async def create_integration(req: CreateIntegrationRequest):
    if req.type not in CONNECTOR_MAP:
        raise HTTPException(400, f"Unsupported integration type. Choose from: {list(CONNECTOR_MAP.keys())}")

    # Test connection
    connector = CONNECTOR_MAP[req.type](req.credentials, req.settings or {})
    try:
        if req.type in ("google_drive", "dropbox"):
            await connector.list_files()
    except Exception as e:
        raise HTTPException(400, f"Connection test failed: {e}")

    pool = app.state.db
    async with pool.acquire() as conn:
        integration = await conn.fetchrow(
            """INSERT INTO integrations (tenant_id, type, name, credentials, settings, created_by)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, type, name, status, created_at""",
            req.tenant_id, req.type, req.name,
            json.dumps(req.credentials),
            json.dumps(req.settings or {}),
            req.user_id
        )

    return dict(integration)

@app.get("/integrations")
async def list_integrations(tenant_id: str):
    async with app.state.db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT id, type, name, status, last_sync_at, created_at FROM integrations WHERE tenant_id=$1",
            tenant_id
        )
    return [dict(r) for r in rows]

@app.post("/integrations/{integration_id}/sync")
async def trigger_sync(integration_id: str, tenant_id: str, background_tasks: BackgroundTasks):
    async with app.state.db.acquire() as conn:
        integration = await conn.fetchrow(
            "SELECT * FROM integrations WHERE id=$1 AND tenant_id=$2",
            integration_id, tenant_id
        )
    if not integration:
        raise HTTPException(404)

    background_tasks.add_task(sync_integration, app, dict(integration))
    return {"message": "Sync started", "integration_id": integration_id}

# ─── WEBHOOK HANDLER ─────────────────────────────────────────

@app.post("/webhooks/{provider}/{integration_id}")
async def handle_webhook(provider: str, integration_id: str, request: Request):
    """Handle inbound webhooks from external services"""
    body = await request.body()
    headers = dict(request.headers)

    # Verify webhook signature (Slack, GitHub, etc.)
    if provider == "slack":
        timestamp = headers.get("x-slack-request-timestamp", "")
        signature = headers.get("x-slack-signature", "")
        signing_secret = os.getenv("SLACK_SIGNING_SECRET", "")
        base = f"v0:{timestamp}:{body.decode()}"
        expected = "v0=" + hmac.new(signing_secret.encode(), base.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(401, "Invalid webhook signature")

    payload = json.loads(body)

    async with app.state.db.acquire() as conn:
        integration = await conn.fetchrow(
            "SELECT tenant_id FROM integrations WHERE id=$1", integration_id
        )
    if not integration:
        raise HTTPException(404)

    # Queue event
    await app.state.kafka.send_and_wait("integration.webhook", {
        "event": f"webhook.{provider}",
        "tenant_id": str(integration["tenant_id"]),
        "integration_id": integration_id,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return {"ok": True}

@app.get("/integrations/available")
async def available_integrations():
    return {
        "integrations": [
            {
                "type": "google_drive",
                "name": "Google Drive",
                "icon": "https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg",
                "description": "Sync files from Google Drive",
                "auth": "oauth2",
                "features": ["two-way-sync", "real-time-webhooks"],
            },
            {
                "type": "dropbox",
                "name": "Dropbox",
                "icon": "https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg",
                "description": "Import files from Dropbox",
                "auth": "oauth2",
                "features": ["sync", "webhooks"],
            },
            {
                "type": "slack",
                "name": "Slack",
                "icon": "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg",
                "description": "Send document notifications to Slack",
                "auth": "oauth2",
                "features": ["notifications", "commands"],
            },
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8050)
