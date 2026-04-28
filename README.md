# DocuFlow — Enterprise AI Document Intelligence Platform


---

## What Is DocuFlow?

DocuFlow is a **multi-tenant, AI-native document intelligence platform** that turns passive document storage into an active knowledge layer. It doesn't just store files — it understands them, connects them, and makes them work for you.

### Why DocuFlow Beats the Competition

| Feature | Google Drive | Notion | SharePoint | **DocuFlow** |
|---|---|---|---|---|
| Semantic search | ❌ | ❌ | ❌ | ✅ |
| Ask-your-docs RAG | ❌ | ❌ | ❌ | ✅ |
| Auto-classification | ❌ | ❌ | Partial | ✅ |
| Knowledge graph | ❌ | ❌ | ❌ | ✅ |
| No-code workflows | ❌ | ❌ | ✅ | ✅ |
| Multi-tenant isolation | Partial | ❌ | ✅ | ✅ |
| Real-time collaboration | ✅ | ✅ | ✅ | ✅ |
| Event-driven integrations | ❌ | ❌ | Partial | ✅ |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOCUFLOW PLATFORM                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    FRONTEND LAYER                         │  │
│  │   Next.js 14 App Router + React + TailwindCSS             │  │
│  │   Real-time via WebSockets | Drag-and-drop | Chat UI      │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │ HTTPS / WSS                      │
│  ┌───────────────────────────▼───────────────────────────────┐  │
│  │                   API GATEWAY LAYER                       │  │
│  │   Kong / AWS API Gateway — Rate limiting, Auth, Routing   │  │
│  └──┬──────────┬──────────┬───────────┬────────────┬─────────┘  │
│     │          │          │           │            │             │
│  ┌──▼──┐  ┌───▼──┐  ┌────▼──┐  ┌────▼──┐  ┌─────▼──┐         │
│  │Auth │  │ Doc  │  │  AI   │  │Workfl.│  │Integr. │         │
│  │Svc  │  │ Svc  │  │  Svc  │  │ Svc   │  │  Svc   │         │
│  └──┬──┘  └───┬──┘  └────┬──┘  └────┬──┘  └─────┬──┘         │
│     │          │          │           │            │             │
│  ┌──▼──────────▼──────────▼───────────▼────────────▼─────────┐  │
│  │                    EVENT BUS (Kafka)                       │  │
│  │   document.uploaded | ai.processed | workflow.triggered   │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │                    DATA LAYER                               │  │
│  │  PostgreSQL (tenants, metadata) | Redis (cache, sessions)  │  │
│  │  Qdrant (vectors) | S3 (blobs) | Elasticsearch (search)    │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
docuflow/
├── frontend/          # Next.js 14 application
│   ├── app/           # App Router pages
│   ├── components/    # Reusable UI components
│   └── lib/           # API clients, utils
├── backend/
│   ├── auth-service/  # JWT, OAuth2, tenant management
│   ├── doc-service/   # Document CRUD, versioning, storage
│   ├── ai-service/    # RAG, embeddings, classification
│   ├── workflow-service/ # Workflow engine
│   └── integration-service/ # External connectors
├── ai-pipeline/       # AI processing pipelines
├── database/          # Schemas, migrations, seeds
├── workflows/         # Workflow templates
├── integrations/      # Integration connectors
├── infra/             # Docker, K8s, Terraform
└── docs/              # Architecture & API docs
```

---

## Quick Start

```bash
# Clone and start all services
git clone https://github.com/your-org/docuflow
cd docuflow
cp .env.example .env  # Fill in your API keys
docker-compose up -d
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
# Kafka UI: http://localhost:8080
```
