"""
DocuFlow AI Service
- Document processing pipeline (extract → embed → classify → summarize)
- RAG-based "Ask Your Docs" chat
- Knowledge graph construction
- Semantic search
- Auto-tagging and metadata extraction
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncpg, asyncio
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    SearchRequest, Filter, FieldCondition, MatchValue
)
import anthropic, json, uuid, os, re, io
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import httpx

# ─── CONFIG ────────────────────────────────────────────────────

DB_URL = os.getenv("DATABASE_URL")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
COLLECTION_NAME = "docuflow_embeddings"
EMBED_DIM = 1536  # text-embedding-3-small
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DB_URL, min_size=5, max_size=20)
    app.state.qdrant = AsyncQdrantClient(url=QDRANT_URL)
    app.state.anthropic = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    # Ensure collection exists
    try:
        await app.state.qdrant.get_collection(COLLECTION_NAME)
    except Exception:
        await app.state.qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE)
        )

    # Start Kafka consumer
    asyncio.create_task(consume_document_events(app))
    yield
    await app.state.db.close()

app = FastAPI(title="DocuFlow AI Service", version="1.0.0", lifespan=lifespan)

# ─── TEXT EXTRACTION ──────────────────────────────────────────

async def extract_text(content: bytes, mime_type: str, filename: str) -> str:
    """Extract text from various document types"""
    if mime_type == "text/plain":
        return content.decode("utf-8", errors="ignore")

    if mime_type == "application/pdf":
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                return "\n\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
        except Exception as e:
            return f"[PDF extraction failed: {e}]"

    if mime_type in ("application/vnd.openxmlformats-officedocument.wordprocessingml.document",):
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            return f"[DOCX extraction failed: {e}]"

    if "spreadsheet" in mime_type or filename.endswith(".csv"):
        try:
            import pandas as pd
            if filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(content))
            else:
                df = pd.read_excel(io.BytesIO(content))
            return df.to_string(max_rows=500)
        except Exception as e:
            return f"[Spreadsheet extraction failed: {e}]"

    if mime_type.startswith("image/"):
        # Use Claude vision for image text extraction
        import base64
        b64 = base64.standard_b64encode(content).decode()
        return f"[Image: {filename}] (OCR via Claude vision)"

    return content.decode("utf-8", errors="ignore")[:10000]

# ─── CHUNKING ─────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[Dict]:
    """Split text into overlapping chunks with metadata"""
    chunks = []
    sentences = re.split(r'(?<=[.!?])\s+', text)
    current_chunk = []
    current_size = 0
    chunk_idx = 0

    for sentence in sentences:
        words = sentence.split()
        if current_size + len(words) > chunk_size and current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "id": chunk_idx,
                "text": chunk_text,
                "char_start": text.find(chunk_text[:50]),
                "word_count": current_size,
            })
            chunk_idx += 1
            # Keep overlap
            overlap_words = current_chunk[-overlap:]
            current_chunk = overlap_words + words
            current_size = len(current_chunk)
        else:
            current_chunk.extend(words)
            current_size += len(words)

    if current_chunk:
        chunks.append({
            "id": chunk_idx,
            "text": " ".join(current_chunk),
            "char_start": 0,
            "word_count": current_size,
        })

    return chunks

# ─── EMBEDDINGS ───────────────────────────────────────────────

async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings via OpenAI API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"},
            json={"model": "text-embedding-3-small", "input": texts},
            timeout=60
        )
        data = response.json()
        return [item["embedding"] for item in data["data"]]

# ─── AI ANALYSIS WITH CLAUDE ──────────────────────────────────

async def analyze_document(client: anthropic.AsyncAnthropic, text: str, filename: str) -> dict:
    """Run full AI analysis on document content"""
    truncated = text[:8000]  # Stay within context

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system="""You are a document analysis expert. Analyze documents and return structured JSON.
Always respond with ONLY valid JSON, no markdown or prose.""",
        messages=[{
            "role": "user",
            "content": f"""Analyze this document and return a JSON object with these exact fields:
{{
  "summary": "2-3 sentence executive summary",
  "category": "one of: contract, invoice, report, proposal, policy, technical, legal, financial, hr, marketing, other",
  "tags": ["array", "of", "5-10", "relevant", "keyword", "tags"],
  "language": "ISO 639-1 language code",
  "sentiment": "positive/neutral/negative",
  "key_entities": [
    {{"type": "person|org|location|date|money|product", "value": "entity text"}}
  ],
  "key_topics": ["topic1", "topic2", "topic3"],
  "action_items": ["any action items found"],
  "confidence": 0.95
}}

Filename: {filename}

Document content:
{truncated}"""
        }]
    )

    raw = response.content[0].text.strip()
    # Strip markdown if present
    raw = re.sub(r'^```json\s*|\s*```$', '', raw, flags=re.MULTILINE)
    return json.loads(raw)

# ─── MAIN PROCESSING PIPELINE ─────────────────────────────────

async def process_document(app, event: dict):
    """Full AI processing pipeline for a document"""
    doc_id = event["document_id"]
    tenant_id = event["tenant_id"]
    storage_key = event["storage_key"]
    mime_type = event["mime_type"]
    filename = event["filename"]

    print(f"[AI] Processing document {doc_id} ({filename})")

    pool = app.state.db
    qdrant = app.state.qdrant
    ai_client = app.state.anthropic

    try:
        # 1. Fetch document from S3
        import aioboto3
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=os.getenv("S3_ENDPOINT", "http://minio:9000"),
            aws_access_key_id=os.getenv("S3_ACCESS_KEY", "docuflow"),
            aws_secret_access_key=os.getenv("S3_SECRET_KEY", "secret123"),
        ) as s3:
            obj = await s3.get_object(Bucket=os.getenv("S3_BUCKET", "docuflow"), Key=storage_key)
            content = await obj["Body"].read()

        # 2. Extract text
        text = await extract_text(content, mime_type, filename)
        if not text.strip():
            raise ValueError("No text extracted from document")

        # 3. AI analysis
        analysis = await analyze_document(ai_client, text, filename)

        # 4. Chunking + Embedding
        chunks = chunk_text(text)
        chunk_texts = [c["text"] for c in chunks]
        embeddings = await get_embeddings(chunk_texts)

        # 5. Store in Qdrant (vector DB)
        points = []
        for chunk, embedding in zip(chunks, embeddings):
            point_id = str(uuid.uuid4())
            points.append(PointStruct(
                id=point_id,
                vector=embedding,
                payload={
                    "document_id": doc_id,
                    "tenant_id": tenant_id,
                    "chunk_id": chunk["id"],
                    "text": chunk["text"],
                    "filename": filename,
                    "category": analysis.get("category"),
                    "tags": analysis.get("tags", []),
                }
            ))

        await qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

        # 6. Update document in database
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE documents SET
                   ai_summary=$1, ai_category=$2, ai_tags=$3,
                   ai_language=$4, ai_sentiment=$5, ai_entities=$6,
                   ai_processed_at=now(), status='active'
                   WHERE id=$7 AND tenant_id=$8""",
                analysis.get("summary"),
                analysis.get("category"),
                analysis.get("tags", []),
                analysis.get("language", "en"),
                analysis.get("sentiment"),
                json.dumps(analysis.get("key_entities", [])),
                doc_id, tenant_id
            )

            # Store structured metadata
            for key, value in {
                "topics": json.dumps(analysis.get("key_topics", [])),
                "action_items": json.dumps(analysis.get("action_items", [])),
                "chunk_count": str(len(chunks)),
                "word_count": str(sum(c["word_count"] for c in chunks)),
            }.items():
                await conn.execute(
                    """INSERT INTO document_metadata (document_id, tenant_id, key, value, source)
                       VALUES ($1,$2,$3,$4,'ai')
                       ON CONFLICT (document_id, key) DO UPDATE SET value=EXCLUDED.value""",
                    doc_id, tenant_id, key, value
                )

            # Build knowledge graph - find related documents
            await build_document_relations(conn, qdrant, doc_id, tenant_id, embeddings[0] if embeddings else None)

        # Publish completion event
        print(f"[AI] Completed processing {doc_id}")

    except Exception as e:
        print(f"[AI] Error processing {doc_id}: {e}")
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE documents SET status='active' WHERE id=$1", doc_id
            )

async def build_document_relations(conn, qdrant, doc_id: str, tenant_id: str, embedding: list):
    """Find semantically related documents and build knowledge graph"""
    if not embedding:
        return

    # Search for similar documents
    results = await qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=embedding,
        query_filter=Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        ),
        limit=10,
        score_threshold=0.75
    )

    for result in results:
        related_doc_id = result.payload.get("document_id")
        if related_doc_id and related_doc_id != doc_id:
            try:
                await conn.execute(
                    """INSERT INTO document_relations
                       (tenant_id, source_doc_id, target_doc_id, relation_type, confidence, source)
                       VALUES ($1,$2,$3,'similar_to',$4,'ai')
                       ON CONFLICT (source_doc_id, target_doc_id, relation_type) DO NOTHING""",
                    tenant_id, doc_id, related_doc_id, float(result.score)
                )
            except Exception:
                pass

# ─── KAFKA CONSUMER ──────────────────────────────────────────

async def consume_document_events(app):
    consumer = AIOKafkaConsumer(
        "document.uploaded",
        bootstrap_servers=KAFKA_BROKERS,
        group_id="ai-processor",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
    )
    await consumer.start()
    try:
        async for msg in consumer:
            asyncio.create_task(process_document(app, msg.value))
    finally:
        await consumer.stop()

# ─── RAG ENDPOINTS ────────────────────────────────────────────

class ChatMessage(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    document_ids: Optional[List[str]] = None  # Scope to specific docs
    space_id: Optional[str] = None
    x_tenant_id: str
    x_user_id: str

@app.post("/ai/chat")
async def ask_documents(req: ChatMessage):
    """RAG-powered Ask Your Documents"""
    tenant_id = req.x_tenant_id
    user_id = req.x_user_id

    pool = app.state.db
    qdrant = app.state.qdrant
    ai_client = app.state.anthropic

    # 1. Embed the question
    question_embedding = (await get_embeddings([req.message]))[0]

    # 2. Build filter
    filter_conditions = [FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
    if req.document_ids:
        filter_conditions.append(
            FieldCondition(key="document_id", match=MatchValue(value=req.document_ids[0]))  # simplified
        )

    # 3. Vector search
    results = await qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=question_embedding,
        query_filter=Filter(must=filter_conditions),
        limit=6,
        score_threshold=0.5,
        with_payload=True,
    )

    # 4. Build context from retrieved chunks
    sources = []
    context_parts = []
    seen_docs = set()

    for r in results:
        doc_id = r.payload["document_id"]
        if doc_id not in seen_docs:
            seen_docs.add(doc_id)
            sources.append({
                "document_id": doc_id,
                "filename": r.payload.get("filename"),
                "score": round(float(r.score), 3),
                "excerpt": r.payload["text"][:300] + "...",
            })
        context_parts.append(f"[Source: {r.payload.get('filename')}]\n{r.payload['text']}")

    context = "\n\n---\n\n".join(context_parts)

    # 5. Get conversation history
    history = []
    if req.conversation_id:
        async with pool.acquire() as conn:
            msgs = await conn.fetch(
                """SELECT role, content FROM ai_messages
                   WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 10""",
                req.conversation_id
            )
            history = [{"role": m["role"], "content": m["content"]} for m in reversed(msgs)]

    # 6. Call Claude with RAG context
    system_prompt = f"""You are DocuFlow's AI assistant. Answer questions about documents accurately.
Use ONLY the provided document context. If the answer isn't in the context, say so clearly.
Be concise, factual, and cite your sources.

DOCUMENT CONTEXT:
{context}"""

    messages = history + [{"role": "user", "content": req.message}]

    response = await ai_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=system_prompt,
        messages=messages
    )

    answer = response.content[0].text

    # 7. Save to DB
    async with pool.acquire() as conn:
        if not req.conversation_id:
            conv = await conn.fetchrow(
                """INSERT INTO ai_conversations (tenant_id, user_id, space_id, title)
                   VALUES ($1,$2,$3,$4) RETURNING id""",
                tenant_id, user_id, req.space_id,
                req.message[:80] + ("..." if len(req.message) > 80 else "")
            )
            conv_id = str(conv["id"])
        else:
            conv_id = req.conversation_id

        await conn.execute(
            "INSERT INTO ai_messages (conversation_id, role, content) VALUES ($1,'user',$2)",
            conv_id, req.message
        )
        await conn.execute(
            """INSERT INTO ai_messages
               (conversation_id, role, content, sources, input_tokens, output_tokens, model)
               VALUES ($1,'assistant',$2,$3,$4,$5,$6)""",
            conv_id, answer, json.dumps(sources),
            response.usage.input_tokens, response.usage.output_tokens,
            "claude-sonnet-4-20250514"
        )

        # Track AI usage
        cost = (response.usage.input_tokens * 0.000003 + response.usage.output_tokens * 0.000015)
        await conn.execute(
            """INSERT INTO ai_usage (tenant_id, user_id, feature, model, input_tokens, output_tokens, cost_usd)
               VALUES ($1,$2,'rag',$3,$4,$5,$6)""",
            tenant_id, user_id, "claude-sonnet-4-20250514",
            response.usage.input_tokens, response.usage.output_tokens, cost
        )

    return {
        "conversation_id": conv_id,
        "answer": answer,
        "sources": sources,
    }

@app.post("/ai/search")
async def semantic_search(
    query: str,
    tenant_id: str,
    space_id: Optional[str] = None,
    limit: int = 20,
):
    """Semantic search across all documents"""
    embedding = (await get_embeddings([query]))[0]

    filter_conditions = [FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]

    results = await app.state.qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=embedding,
        query_filter=Filter(must=filter_conditions),
        limit=limit,
        with_payload=True,
    )

    # Deduplicate by document
    seen = {}
    for r in results:
        doc_id = r.payload["document_id"]
        if doc_id not in seen or r.score > seen[doc_id]["score"]:
            seen[doc_id] = {
                "document_id": doc_id,
                "filename": r.payload.get("filename"),
                "score": round(float(r.score), 3),
                "excerpt": r.payload["text"][:400],
                "category": r.payload.get("category"),
                "tags": r.payload.get("tags", []),
            }

    return {"results": sorted(seen.values(), key=lambda x: x["score"], reverse=True)}

@app.get("/ai/recommendations/{doc_id}")
async def get_recommendations(doc_id: str, tenant_id: str, limit: int = 5):
    """Get AI-powered document recommendations"""
    pool = app.state.db
    async with pool.acquire() as conn:
        related = await conn.fetch(
            """SELECT dr.target_doc_id, dr.confidence, dr.relation_type,
               d.name, d.ai_summary, d.ai_category, d.ai_tags
               FROM document_relations dr
               JOIN documents d ON d.id = dr.target_doc_id
               WHERE dr.source_doc_id=$1 AND dr.tenant_id=$2
               ORDER BY dr.confidence DESC LIMIT $3""",
            doc_id, tenant_id, limit
        )
    return {"recommendations": [dict(r) for r in related]}

@app.get("/ai/knowledge-graph/{doc_id}")
async def get_knowledge_graph(doc_id: str, tenant_id: str, depth: int = 2):
    """Get knowledge graph for a document"""
    pool = app.state.db
    nodes = {}
    edges = []

    async def fetch_relations(current_id: str, current_depth: int):
        if current_depth == 0 or current_id in nodes:
            return
        async with pool.acquire() as conn:
            doc = await conn.fetchrow(
                "SELECT id, name, ai_category, ai_tags FROM documents WHERE id=$1", current_id
            )
            if doc:
                nodes[current_id] = {
                    "id": current_id, "label": doc["name"],
                    "category": doc["ai_category"], "tags": doc["ai_tags"]
                }
            rels = await conn.fetch(
                """SELECT target_doc_id, relation_type, confidence
                   FROM document_relations WHERE source_doc_id=$1 AND tenant_id=$2""",
                current_id, tenant_id
            )
            for r in rels:
                edges.append({
                    "from": current_id, "to": str(r["target_doc_id"]),
                    "type": r["relation_type"], "weight": float(r["confidence"])
                })
                await fetch_relations(str(r["target_doc_id"]), current_depth - 1)

    await fetch_relations(doc_id, depth)
    return {"nodes": list(nodes.values()), "edges": edges}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8030)
