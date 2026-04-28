# DocuFlow Architecture Deep-Dive

## 1. System Architecture

### Multi-Tenant Isolation Strategy

```
Tenant A ──┐
Tenant B ──┤──► API Gateway (JWT with tid claim)
Tenant C ──┘         │
                      ▼
            ┌─────────────────────┐
            │  Each microservice  │
            │  sets PostgreSQL    │
            │  app.tenant_id      │
            │  session variable   │
            │  → RLS enforced     │
            └─────────────────────┘
```

**Row-Level Security (RLS)**: Every table with tenant data has RLS policies that
filter by `current_setting('app.tenant_id')`. Application sets this on every
connection before querying. Even if code has a bug and forgets to filter by
tenant_id, the database enforces isolation automatically.

**Storage Isolation**: Files stored at `tenants/{tenant_id}/docs/{doc_id}/...`
in S3. IAM policies enforce bucket-level access per tenant in production.

**Vector DB Isolation**: Qdrant payload field `tenant_id` used in every query
filter. Future: dedicated Qdrant collections per enterprise tenant.

---

## 2. Event-Driven Pipeline

```
Upload API ──► Kafka: document.uploaded
                          │
              ┌───────────┼──────────────┐
              ▼           ▼              ▼
         AI Service   Workflow       Audit Log
         (process)    Engine         Consumer
              │        (triggers)
              ▼
    document.ai_processed
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
  Search    Graph    Notify
  Index     Build    Users
```

**Kafka Topics**:
- `document.uploaded` — triggers AI pipeline + workflows
- `document.updated` — triggers re-indexing, workflow checks
- `document.deleted` — tombstone in vector DB, audit
- `integration.sync` — background file discovery
- `integration.webhook` — inbound from external services
- `ai.completed` — AI processing done, update status
- `notification.send` — fan-out to WebSocket + email + Slack

---

## 3. AI Pipeline Design

### Document Processing Flow

```
Raw File (PDF/DOCX/XLSX/Image)
        │
        ▼
[Text Extraction Layer]
  - pdfplumber for PDFs
  - python-docx for Word
  - pandas for spreadsheets
  - Claude Vision for images/scans
        │
        ▼
[Chunking Engine]
  - Sentence-aware splitting
  - 1000 token chunks
  - 200 token overlap
  - Preserves context boundaries
        │
        ├──────────────────────────────────────────┐
        ▼                                          ▼
[Embedding via OpenAI]                    [AI Analysis via Claude]
  text-embedding-3-small                  - Summary (2-3 sentences)
  1536 dimensions                         - Category classification
  Batch processing                        - Tag extraction (5-10 tags)
        │                                 - Entity extraction
        ▼                                 - Sentiment analysis
[Qdrant Vector DB]                        - Action items
  - HNSW index                            - Language detection
  - Tenant-filtered search                        │
  - Cosine similarity                             ▼
        │                                [PostgreSQL Update]
        ▼                                  documents table
[Knowledge Graph]                          ai_summary, ai_tags
  Find similar docs                        ai_category, entities
  Create relations                                │
  Build topic clusters                           ▼
                                         [Search Index Update]
                                           Elasticsearch + FTS
```

### RAG Query Flow

```
User Question
     │
     ▼
[Embed Question]  ──► OpenAI API
     │
     ▼
[Qdrant Search]
  Filter: tenant_id = current_tenant
  Score threshold: 0.5
  Top-K: 6 chunks
     │
     ▼
[Context Assembly]
  Deduplicate by document
  Rank by relevance
  Truncate to fit context
     │
     ▼
[Claude claude-sonnet-4-20250514]
  System: "Use ONLY provided context"
  Context: Top-K chunks with filenames
  History: Last 10 messages
     │
     ▼
[Response + Citations]
  Answer with sources
  Track token usage
  Log to ai_usage table
```

---

## 4. Database Design Patterns

### Optimistic Versioning

Documents use `version` + `is_latest` pattern:
```sql
-- When uploading new version:
UPDATE documents SET is_latest = false WHERE id = $doc_id;
INSERT INTO documents (..., version = current+1, is_latest = true);
INSERT INTO document_versions (...);
```

### JSONB for Flexibility

- `documents.ai_entities` — array of extracted entities
- `workflows.trigger` — flexible trigger config
- `workflows.steps` — full DAG definition
- `audit_logs.metadata` — extensible context

### Full-Text Search

```sql
-- GIN index on tsvector for millisecond FTS
CREATE INDEX idx_docs_fts ON documents USING GIN (
  to_tsvector('english',
    coalesce(name,'') || ' ' ||
    coalesce(description,'') || ' ' ||
    coalesce(ai_summary,'')
  )
);
```

---

## 5. Caching Strategy

```
Request
   │
   ▼
[Redis L1 Cache]  ← Hot: doc metadata, user sessions, permissions
   │ MISS
   ▼
[PostgreSQL]      ← Warm: full document records
   │
   ▼
[S3]              ← Cold: binary file content

Cache Keys:
  doc:{id}                    TTL: 5 min
  docs:list:{tenant}:{space}  TTL: 1 min (invalidated on write)
  session:{user_id}           TTL: 30 days
  ratelimit:integration:{id}  TTL: 60s window

Cache Invalidation:
  On document update → delete doc:{id} + docs:list:*
  On document upload → delete docs:list:{tenant}:{space}
  Tenant-scoped keys → never bleed across tenants
```

---

## 6. Security Architecture

### Authentication Flow
```
Browser → POST /auth/login → JWT (1hr) + Refresh (30d)
        → All API requests: Authorization: Bearer <JWT>
        → API Gateway validates JWT
        → Extracts: sub (user_id), tid (tenant_id), role
        → Injects as headers to microservices
```

### Fine-Grained Access Control (ABAC)

```
Permission check order:
1. Is user the document creator? → ALLOW
2. Is user in document_permissions with sufficient permission? → per rule
3. Is user a space_member? → space-level access
4. Does a group the user belongs to have access? → group check
5. Is document public? → public access
6. DENY
```

### Encryption
- **At rest**: S3 server-side encryption (AES-256 with AWS KMS in prod)
- **In transit**: TLS 1.3 everywhere
- **Application-level**: Integration credentials encrypted with AES-256-GCM before storing in DB
- **Tokens**: Never stored; only hashed token stored in sessions table

---

## 7. Workflow Engine Design

### DAG Execution Model

```json
{
  "id": "wf-001",
  "trigger": {"type": "document.uploaded", "filters": {"mime_type": "application/pdf"}},
  "steps": [
    {"id": "s1", "type": "condition", "config": {"field": "ai_category", "operator": "equals", "value": "contract"}, "on_condition_true": "s2", "on_condition_false": null},
    {"id": "s2", "type": "tag", "config": {"tags": ["contract", "review-needed"]}, "next_step": "s3"},
    {"id": "s3", "type": "approval", "config": {"approver_id": "user-legal-team"}, "next_step": "s4"},
    {"id": "s4", "type": "notification", "config": {"channel": "slack", "template": "Contract {document_name} needs review"}}
  ]
}
```

### Execution Context

Each step receives a context object that accumulates outputs:
```python
context = {
  "tenant_id": "...",
  "document_id": "...",
  "document_name": "Contract Draft.pdf",
  "ai_category": "contract",           # from document
  "condition_result": True,            # from condition step
  "approval_id": "approval-123",       # from approval step
  ...step_outputs_accumulate_here
}
```

---

## 8. Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 14, React, TailwindCSS | App Router, RSC, best DX |
| API Gateway | Kong | Open source, declarative config |
| Auth | FastAPI + JWT + bcrypt | Stateless, fast, secure |
| Documents | FastAPI + asyncpg | Async I/O, high throughput |
| AI Service | FastAPI + Anthropic + Qdrant | Native async, best LLM |
| Workflows | FastAPI + Kafka consumer | Event-driven, reliable |
| Integrations | FastAPI + httpx | Async HTTP, OAuth2 |
| Primary DB | PostgreSQL 16 | JSONB, FTS, RLS, proven |
| Cache | Redis 7 | Fast, pub/sub, sessions |
| Vector DB | Qdrant | Rust, fast, filtering |
| Full-text | Elasticsearch 8 | Complex queries at scale |
| Object Store | S3 / MinIO | Durable, scalable, cheap |
| Message Bus | Apache Kafka | At-least-once, replay |
| Observability | Prometheus + Grafana | Industry standard |
| Container | Docker + Kubernetes | Cloud-native |
| AI Models | Claude claude-sonnet-4-20250514 (analysis) + OpenAI embed | Best quality + cost |

---

## 9. Roadmap: MVP → Scale → Enterprise

### Phase 1 — MVP (Months 1-3)
- [ ] Core auth: register, login, JWT, tenant creation
- [ ] Document upload/download with S3 storage
- [ ] Basic AI processing: extract text, embed, classify
- [ ] Simple semantic search (Qdrant)
- [ ] Ask Your Docs (RAG) — single conversation
- [ ] Basic UI: dashboard, document grid, chat

### Phase 2 — Growth (Months 4-6)
- [ ] Workflow engine with 6 step types
- [ ] Google Drive + Dropbox + Slack integrations
- [ ] Knowledge graph visualization
- [ ] Document versioning + approval workflows
- [ ] Team spaces + RBAC
- [ ] Real-time collaboration (WebSockets)
- [ ] Advanced search with filters + facets

### Phase 3 — Scale (Months 7-9)
- [ ] Kubernetes deployment with auto-scaling
- [ ] Multi-region data residency
- [ ] Advanced analytics dashboard
- [ ] Custom AI models per tenant
- [ ] API access + SDK for developers
- [ ] SOC 2 Type II compliance
- [ ] Audit trails + compliance reports

### Phase 4 — Enterprise (Months 10-12)
- [ ] SSO (SAML 2.0, OIDC)
- [ ] Custom LLM fine-tuning per tenant
- [ ] On-premise / VPC deployment option
- [ ] Data Loss Prevention (DLP) policies
- [ ] Advanced ABAC with policy engine (OPA)
- [ ] Document digitization (OCR + scanning)
- [ ] Enterprise integrations (SAP, Oracle, Salesforce)
- [ ] White-label options

---

## 10. Competitive Differentiation

### vs. Google Drive
- ✅ AI understands document content, not just filename
- ✅ Ask questions across ALL documents at once
- ✅ Auto-classification without manual organization
- ✅ Workflow automation built-in

### vs. Notion
- ✅ Designed for files, not pages — handles PDFs, DOCX, images natively
- ✅ Enterprise-grade RBAC and audit trails
- ✅ True multi-tenant isolation
- ✅ Integration platform with 50+ connectors

### vs. SharePoint
- ✅ 10x simpler UX — no IT team required
- ✅ AI-first: semantic search beats keyword search
- ✅ Modern cloud-native architecture — no on-prem complexity
- ✅ 10x faster to deploy and onboard

### Unique DocuFlow Features
1. **Knowledge Graph** — see how documents relate to each other
2. **AI Chat with source citations** — know exactly where answers come from
3. **Zero-setup AI processing** — upload and AI does the rest
4. **Workflow automation that understands content** — route contracts vs reports differently
5. **Cross-integration intelligence** — connect Drive + Slack + CRM and let AI synthesize
