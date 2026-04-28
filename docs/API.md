# DocuFlow API Reference

Base URL: `https://api.docuflow.io` (or `http://localhost:8000` locally)

All authenticated endpoints require: `Authorization: Bearer <access_token>`

---

## Auth Service (`/auth`)

### POST /auth/register
Create account and tenant.
```json
{
  "email": "user@company.com",
  "password": "secure-password",
  "name": "Jane Doe",
  "tenant_slug": "my-company"
}
```
**Response**: `{ access_token, refresh_token, user, tenant }`

### POST /auth/login
```json
{ "email": "user@company.com", "password": "...", "tenant_slug": "my-company" }
```

### POST /auth/refresh
```json
{ "refresh_token": "..." }
```

### POST /auth/logout
Revokes current token. Header: `Authorization: Bearer <token>`

### GET /auth/me
Returns current user + tenant info.

---

## Document Service (`/documents`)

### POST /documents/upload
`multipart/form-data`:
- `file` (required): The file to upload
- `space_id` (optional): Target space UUID
- `parent_id` (optional): Parent folder UUID

**Response**: `{ id, name, status: "processing", size, mime_type }`

### GET /documents
Query params:
- `space_id`, `parent_id`
- `search` — full-text search query
- `tags` — comma-separated tag filter
- `category` — AI category filter
- `page`, `per_page` (default: 50)
- `sort` (name|updated_at|created_at|storage_size), `order` (asc|desc)

### GET /documents/:id
Full document with metadata and AI analysis.

### GET /documents/:id/download
Returns file binary with `Content-Disposition: attachment` header.

### DELETE /documents/:id
Moves to trash (soft delete).

### GET /spaces
List spaces the current user is a member of.

### POST /spaces
```json
{ "name": "My Space", "description": "...", "icon": "🗂️" }
```

---

## AI Service (`/ai`)

### POST /ai/chat
Ask questions across your documents (RAG).
```json
{
  "message": "Summarize all contracts expiring this quarter",
  "conversation_id": null,
  "document_ids": null,
  "space_id": null
}
```
**Response**:
```json
{
  "conversation_id": "uuid",
  "answer": "Based on your documents...",
  "sources": [
    {
      "document_id": "uuid",
      "filename": "Contract_Acme.pdf",
      "score": 0.92,
      "excerpt": "This agreement expires on March 31, 2025..."
    }
  ]
}
```

### POST /ai/search
Semantic search (returns chunks, not just documents).
```json
{ "query": "pricing negotiation terms", "tenant_id": "...", "limit": 20 }
```

### GET /ai/recommendations/:doc_id
Get AI-recommended related documents.

### GET /ai/knowledge-graph/:doc_id
Get document relationships as a graph.
```json
{
  "nodes": [{"id": "uuid", "label": "filename", "category": "contract"}],
  "edges": [{"from": "uuid", "to": "uuid", "type": "similar_to", "weight": 0.87}]
}
```

---

## Workflow Service (`/workflows`)

### POST /workflows
```json
{
  "name": "Auto-tag Contracts",
  "trigger": { "type": "document.uploaded", "filters": {} },
  "steps": [
    { "id": "s1", "type": "condition", "name": "Is contract?",
      "config": { "field": "ai_category", "operator": "equals", "value": "contract" },
      "on_condition_true": "s2", "on_condition_false": null },
    { "id": "s2", "type": "tag", "name": "Add tags",
      "config": { "tags": ["contract", "legal"] }, "next_step": null }
  ]
}
```

### GET /workflows
List all tenant workflows.

### POST /workflows/:id/trigger
Manually trigger a workflow with custom data.

### GET /workflows/:id/runs
Execution history with per-step logs.

### GET /step-types
Returns available trigger types and step types.

---

## Integration Service (`/integrations`)

### POST /integrations
```json
{
  "type": "google_drive",
  "name": "Marketing Drive",
  "credentials": { "access_token": "...", "refresh_token": "..." },
  "settings": { "folder_id": "1BxiMV......" }
}
```

### GET /integrations
List all tenant integrations with sync status.

### POST /integrations/:id/sync
Trigger immediate sync.

### POST /webhooks/:provider/:integration_id
Receive inbound webhooks (Slack events, Drive push notifications, etc.)

### GET /integrations/available
Returns all available integration types with metadata.

---

## WebSocket

### WS /ws/:tenant_id/:user_id
Real-time events pushed to client:
```json
{ "type": "document.ai_processed", "document_id": "...", "data": {...} }
{ "type": "notification", "notification": {...} }
{ "type": "workflow.completed", "run_id": "...", "status": "success" }
{ "type": "document.uploaded_by_colleague", "document": {...} }
```

---

## Error Format

All errors follow RFC 7807:
```json
{
  "error": "validation_error",
  "message": "Email already registered in this tenant",
  "status": 409,
  "details": {}
}
```

**HTTP Status Codes**:
- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized (token missing/expired)
- `403` Forbidden (insufficient permissions)
- `404` Not Found
- `409` Conflict
- `413` Payload Too Large
- `429` Too Many Requests
- `500` Internal Server Error
