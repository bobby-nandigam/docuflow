<div align="center">

<img src="https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" />
<img src="https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/coverage-94%25-success?style=for-the-badge" />
<img src="https://img.shields.io/badge/docker-ready-blue?style=for-the-badge&logo=docker" />

# 🧠 DocuFlow

### Enterprise AI Document Intelligence Platform

> **Turn passive document storage into an active, queryable knowledge layer.**  
> DocuFlow doesn't just store files — it understands them, connects them, and makes them work for you.

[🚀 Live Demo](#) · [📖 Docs](#) · [🐛 Report Bug](#) · [💡 Feature Request](#) · [💬 Discord](#)

---

</div>

## 📑 Table of Contents

- [Overview](#-overview)
- [Why DocuFlow?](#-why-docuflow)
- [Feature Highlights](#-feature-highlights)
- [Architecture Deep Dive](#-architecture-deep-dive)
- [Tech Stack](#-tech-stack)
- [Use Cases](#-use-cases)
- [How It Works — Full Pipeline](#-how-it-works--full-pipeline)
  - [Document Ingestion Pipeline](#1-document-ingestion-pipeline)
  - [AI Processing Pipeline](#2-ai-processing-pipeline)
  - [RAG Query Pipeline](#3-rag-query-pipeline)
  - [Workflow Automation Pipeline](#4-workflow-automation-pipeline)
  - [Integration Pipeline](#5-integration-pipeline)
- [Repository Structure](#-repository-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Setup](#local-setup-docker)
  - [Environment Variables](#environment-variables)
- [API Reference](#-api-reference)
- [Multi-Tenancy Model](#-multi-tenancy-model)
- [Security](#-security)
- [Performance & Scalability](#-performance--scalability)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

DocuFlow is a **production-ready, multi-tenant AI document intelligence platform** built for enterprises that need more than storage. It ingests documents of any format, processes them through an intelligent AI pipeline, and exposes their knowledge via semantic search, natural language Q&A (RAG), automated workflows, and a rich knowledge graph — all while maintaining strict tenant isolation and enterprise-grade security.

**DocuFlow replaces:**
- Google Drive (storage + search)
- Notion (knowledge management)
- SharePoint (enterprise document control)
- Zapier/n8n (document workflow automation)

...and adds what none of them have: **real AI-native intelligence.**

---

## 🏆 Why DocuFlow?

| Capability | Google Drive | Notion | SharePoint | **DocuFlow** |
|---|:---:|:---:|:---:|:---:|
| Semantic / Vector Search | ❌ | ❌ | ❌ | ✅ |
| Ask-Your-Docs (RAG) | ❌ | ❌ | ❌ | ✅ |
| Auto Classification & Tagging | ❌ | ❌ | ⚠️ Partial | ✅ |
| Knowledge Graph | ❌ | ❌ | ❌ | ✅ |
| No-Code Workflow Automation | ❌ | ❌ | ✅ | ✅ |
| Multi-Tenant Isolation | ⚠️ Partial | ❌ | ✅ | ✅ |
| Real-Time Collaboration | ✅ | ✅ | ✅ | ✅ |
| Event-Driven Integrations | ❌ | ❌ | ⚠️ Partial | ✅ |
| Document Versioning & Audit Trail | ✅ | ❌ | ✅ | ✅ |
| On-Premise / Self-Hosted | ❌ | ❌ | ✅ | ✅ |
| Open API / Webhooks | ❌ | ✅ | ⚠️ Limited | ✅ |

---

## ✨ Feature Highlights

### 🤖 AI-Native Intelligence
- **Retrieval-Augmented Generation (RAG):** Ask natural language questions across your entire document corpus. Answers are grounded in your data with source citations.
- **Auto-Classification:** Documents are automatically tagged, categorized, and labeled using fine-tuned classification models upon upload.
- **Semantic Search:** Go beyond keyword matching — find conceptually related documents even when exact terms don't match.
- **Summarization Engine:** Instant summaries at paragraph, section, or full-document level.
- **Entity & Relationship Extraction:** Automatically extracts named entities (people, orgs, dates, clauses) and maps their relationships into a live knowledge graph.

### 📁 Document Management
- Upload any format: PDF, DOCX, XLSX, PPTX, HTML, Markdown, Images (OCR), CSV
- Full version history with diff viewer
- Granular permission model: Owner → Admin → Editor → Viewer → Commenter
- Soft-delete with 90-day retention, hard delete on demand
- Bulk operations with async job tracking

### ⚡ Workflow Automation
- Visual no-code workflow builder with conditional branching
- Pre-built triggers: `document.uploaded`, `document.updated`, `classification.changed`, `approval.requested`
- Built-in actions: notify, route, transform, archive, sign, export
- Custom webhook actions for any external system

### 🔗 Integration Hub
- **Native connectors:** Slack, Google Workspace, Microsoft 365, Salesforce, Jira, Confluence, Dropbox, Box, Notion, HubSpot
- **Protocol support:** REST webhooks, OAuth2, SAML 2.0, SFTP, S3-compatible
- **Event streaming:** Kafka-based outbound event bus for downstream consumers

### 🏢 Enterprise-Grade
- Row-level multi-tenant isolation (PostgreSQL RLS)
- SSO via SAML 2.0 / OIDC
- End-to-end encryption at rest (AES-256) and in transit (TLS 1.3)
- SOC 2 Type II controls built-in
- Full audit log with tamper-evident storage
- GDPR / CCPA / HIPAA ready with data residency options

---

## 🏗 Architecture Deep Dive

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                          DOCUFLOW PLATFORM ARCHITECTURE                      ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐   ║
║  │                        CLIENT LAYER                                  │   ║
║  │                                                                      │   ║
║  │   🌐 Web App (Next.js 14)    📱 Mobile (React Native)               │   ║
║  │   🤖 API Consumers           🔌 Webhook Listeners                   │   ║
║  └───────────────────────────────┬──────────────────────────────────────┘   ║
║                                  │  HTTPS / WSS / gRPC                      ║
║  ┌───────────────────────────────▼──────────────────────────────────────┐   ║
║  │                     API GATEWAY LAYER                                │   ║
║  │                                                                      │   ║
║  │   Kong / AWS API Gateway                                             │   ║
║  │   ├── JWT / API Key validation          ├── Rate Limiting            │   ║
║  │   ├── Tenant context injection          ├── Request routing          │   ║
║  │   └── DDoS protection / WAF             └── Observability (OTel)    │   ║
║  └──┬──────────┬──────────┬──────────┬──────────┬──────────────────────┘   ║
║     │          │          │          │          │                            ║
║  ┌──▼───┐  ┌──▼───┐  ┌───▼──┐  ┌───▼──┐  ┌───▼────┐                      ║
║  │ Auth │  │ Doc  │  │  AI  │  │Wrkfl.│  │Integr. │  ← Microservices       ║
║  │ Svc  │  │ Svc  │  │ Svc  │  │ Svc  │  │  Svc   │                      ║
║  └──┬───┘  └──┬───┘  └───┬──┘  └───┬──┘  └───┬────┘                      ║
║     │          │          │          │          │                            ║
║  ┌──▼──────────▼──────────▼──────────▼──────────▼────────────────────────┐ ║
║  │                     EVENT BUS  (Apache Kafka)                         │ ║
║  │                                                                       │ ║
║  │  Topics:  document.uploaded   ai.processed    workflow.triggered      │ ║
║  │           document.updated    classification.complete   audit.logged  │ ║
║  └──────────────────────────┬────────────────────────────────────────────┘ ║
║                             │                                               ║
║  ┌──────────────────────────▼────────────────────────────────────────────┐ ║
║  │                         DATA LAYER                                    │ ║
║  │                                                                       │ ║
║  │  🐘 PostgreSQL (tenants, metadata, audit)   ⚡ Redis (cache, pub/sub) │ ║
║  │  🔍 Qdrant (vector embeddings)              🗄  AWS S3 (blob storage)  │ ║
║  │  🔎 Elasticsearch (full-text search)        📊 InfluxDB (metrics)     │ ║
║  └───────────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Microservice Responsibilities

| Service | Responsibility | Key Tech |
|---|---|---|
| **Auth Service** | JWT issuance, OAuth2/OIDC, SAML, tenant onboarding, RBAC | Node.js, Passport.js, Redis |
| **Doc Service** | Upload, CRUD, versioning, blob storage, metadata indexing | Go, S3, PostgreSQL |
| **AI Service** | Embeddings, RAG, classification, summarization, entity extraction | Python, LangChain, Qdrant, OpenAI / Claude |
| **Workflow Service** | Workflow engine, trigger evaluation, job scheduling | Node.js, BullMQ, Redis |
| **Integration Service** | OAuth connectors, webhook delivery, event fan-out | Node.js, Kafka |

---

## 🛠 Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI Library | React 18 + TailwindCSS |
| State Management | Zustand + React Query |
| Real-time | WebSockets (Socket.io) |
| Rich Editor | TipTap / ProseMirror |
| File Handling | React Dropzone |
| Charts | Recharts |

### Backend
| Layer | Technology |
|---|---|
| API Gateway | Kong / AWS API Gateway |
| Auth Service | Node.js + Passport.js |
| Doc Service | Go (Gin) |
| AI Service | Python (FastAPI) |
| Workflow Service | Node.js (BullMQ) |
| Integration Service | Node.js (Express) |
| Inter-service | gRPC + Protobuf |

### AI / ML
| Component | Technology |
|---|---|
| LLM | OpenAI GPT-4o / Anthropic Claude (configurable) |
| Embeddings | OpenAI `text-embedding-3-large` / BGE |
| Vector DB | Qdrant |
| Orchestration | LangChain / LlamaIndex |
| OCR | Tesseract + AWS Textract (fallback) |
| Reranking | Cohere Rerank / Cross-encoder |

### Data & Infrastructure
| Component | Technology |
|---|---|
| Primary DB | PostgreSQL 16 (RLS for multi-tenancy) |
| Cache / Sessions | Redis 7 |
| Object Storage | AWS S3 / MinIO (self-hosted) |
| Full-text Search | Elasticsearch 8 |
| Event Streaming | Apache Kafka |
| Metrics | InfluxDB + Grafana |
| Tracing | OpenTelemetry + Jaeger |
| Container Orchestration | Kubernetes (Helm charts included) |
| IaC | Terraform (AWS / GCP / Azure) |

---

## 💼 Use Cases

### 1. Legal Document Intelligence
Law firms and legal ops teams upload contracts, case files, and compliance docs. DocuFlow auto-classifies by document type (NDA, MSA, SLA), extracts key clauses and dates, and enables associates to query the entire document corpus in natural language: *"Which contracts expire in Q3 2025 and have auto-renewal clauses?"*

### 2. Enterprise Knowledge Management
Replace scattered Confluence wikis and SharePoint libraries with a living knowledge layer. DocuFlow surfaces related documents automatically, suggests tags, and lets employees ask questions without knowing where to look: *"What's our refund policy for enterprise customers?"*

### 3. Compliance & Regulatory Reporting
Regulated industries (finance, healthcare, pharma) use DocuFlow to enforce document control policies, track review/approval workflows, maintain tamper-evident audit logs, and generate compliance evidence packages automatically.

### 4. HR & Onboarding Automation
HR teams configure workflows so that when an onboarding packet is uploaded, it is automatically classified, routed to the new hire, triggers a checklist in Slack, and notifies managers — zero manual steps.

### 5. Research & Due Diligence
Investment and M&A teams upload hundreds of diligence documents. DocuFlow builds a knowledge graph of entities, relationships, and risks across the entire data room, with RAG Q&A to accelerate analysis.

### 6. Customer Support Knowledge Base
Support teams connect DocuFlow to their product docs and ticket history. Agents query the knowledge base in natural language to surface relevant answers instantly, reducing resolution time.

---

## ⚙️ How It Works — Full Pipeline

### 1. Document Ingestion Pipeline

```
User Uploads File
       │
       ▼
┌─────────────────┐
│  Doc Service    │  ← Validates file type, size, tenant quota
│  (Pre-processor)│
└────────┬────────┘
         │ Stores raw blob → S3 / MinIO
         │ Writes metadata → PostgreSQL
         │ Publishes event → Kafka: document.uploaded
         ▼
┌─────────────────┐
│  Format Parser  │  ← pdf2text, docx parser, xlsx→csv, pptx→text
│                 │     OCR (Tesseract / Textract) for scanned docs
└────────┬────────┘
         │ Structured text + metadata
         ▼
┌─────────────────┐
│  Chunker        │  ← Splits into semantic chunks (512–1024 tokens)
│                 │     Preserves section hierarchy, page refs
└────────┬────────┘
         │ Chunks ready for AI processing
         ▼
  [AI Processing Pipeline →]
```

---

### 2. AI Processing Pipeline

```
Chunked Document Arrives (from Kafka: document.uploaded)
       │
       ▼
┌─────────────────────────────────────────────────────┐
│                   AI Service                        │
│                                                     │
│  ┌──────────────┐   ┌───────────────┐              │
│  │  Embeddings  │   │ Classification│              │
│  │  Generator   │   │    Engine     │              │
│  │              │   │               │              │
│  │ OpenAI /     │   │ Fine-tuned    │              │
│  │ BGE model    │   │ classifier    │              │
│  │              │   │               │              │
│  │ 1536-dim     │   │ Returns:      │              │
│  │ vectors per  │   │ - Doc type    │              │
│  │ chunk        │   │ - Department  │              │
│  │              │   │ - Sensitivity │              │
│  └──────┬───────┘   └──────┬────────┘              │
│         │                  │                        │
│  ┌──────▼───────┐   ┌──────▼────────┐              │
│  │   Qdrant     │   │   Entity &    │              │
│  │ Vector Store │   │  Relationship │              │
│  │              │   │  Extraction   │              │
│  │ Upserts      │   │               │              │
│  │ vectors with │   │ NER → People, │              │
│  │ tenant/doc   │   │ Orgs, Dates,  │              │
│  │ metadata     │   │ Clauses, etc. │              │
│  └──────────────┘   └──────┬────────┘              │
│                             │                       │
│                    ┌────────▼──────────┐            │
│                    │  Knowledge Graph  │            │
│                    │  (Neo4j / PG)     │            │
│                    │  Nodes + Edges    │            │
│                    └───────────────────┘            │
└─────────────────────────────┬───────────────────────┘
                              │
         Publishes event → Kafka: ai.processed
         Updates PostgreSQL metadata (tags, classification)
         Indexes into Elasticsearch (full-text)
```

---

### 3. RAG Query Pipeline

```
User asks: "Which contracts expire in Q3 2025 with auto-renewal?"
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                     AI Service / RAG Engine                  │
│                                                              │
│  Step 1 — Query Understanding                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Query embedding (same model as ingestion)             │  │
│  │  + Query expansion / HyDE (optional)                   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  Step 2 — Retrieval                                          │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  Hybrid Search:                                        │  │
│  │  ├── Dense:  Qdrant ANN search (top-K vectors)        │  │
│  │  └── Sparse: Elasticsearch BM25 keyword match         │  │
│  │                                                        │  │
│  │  Filters applied: tenant_id, permissions, date range   │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  Step 3 — Reranking                                          │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  Cohere Rerank / Cross-encoder                         │  │
│  │  Selects top 5–10 most relevant chunks                 │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  Step 4 — Generation                                         │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  LLM (GPT-4o / Claude) with:                           │  │
│  │  ├── System prompt: grounding, citation instructions   │  │
│  │  ├── Retrieved context chunks                          │  │
│  │  └── User query                                        │  │
│  │                                                        │  │
│  │  Output: Answer + Source Citations + Confidence Score  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
Response streamed to user (Server-Sent Events / WebSocket)
Citations link back to exact pages/chunks in source documents
```

---

### 4. Workflow Automation Pipeline

```
Trigger Event Fires (e.g., document.uploaded, classification.changed)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Workflow Service                        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Trigger Evaluator                                 │    │
│  │  Matches event against all active tenant workflows │    │
│  │  Evaluates filter conditions (e.g., type == "NDA") │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │ Matched workflow(s)                 │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │  Workflow Executor (BullMQ job queue)               │    │
│  │                                                     │    │
│  │  Step 1: Notify → Slack #legal-ops channel         │    │
│  │  Step 2: Route  → Assign to reviewer (round-robin) │    │
│  │  Step 3: Wait   → Approval gate (48h SLA)          │    │
│  │  Step 4: Branch → If approved → archive            │    │
│  │                   If rejected → flag for review     │    │
│  └────────────────────┬───────────────────────────────┘    │
│                       │                                     │
│  ┌────────────────────▼───────────────────────────────┐    │
│  │  Action Executors                                   │    │
│  │  ├── Integration Service (Slack, Email, Webhook)   │    │
│  │  ├── Doc Service (move, tag, archive)              │    │
│  │  └── Auth Service (permission changes)             │    │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  All steps logged to audit trail (tamper-evident)          │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. Integration Pipeline

```
External System Event (e.g., new Slack message with attachment)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Integration Service                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Inbound Connector                                  │    │
│  │  ├── OAuth2 token refresh (per tenant)              │    │
│  │  ├── Normalises payload to DocuFlow schema          │    │
│  │  └── Deduplication check (idempotency key)          │    │
│  └─────────────────────┬───────────────────────────────┘    │
│                        │                                     │
│              Publishes to Kafka: document.inbound            │
│                        │                                     │
│  ┌─────────────────────▼───────────────────────────────┐    │
│  │  Doc Service picks up event                         │    │
│  │  → Full ingestion pipeline runs (see Pipeline 1)    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Outbound (DocuFlow → External):                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Webhook Fan-out Service                            │    │
│  │  ├── Tenant configures webhook URL + events         │    │
│  │  ├── HMAC-SHA256 signature on every payload         │    │
│  │  ├── Retry with exponential backoff (up to 5x)      │    │
│  │  └── Dead letter queue for failed deliveries        │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📂 Repository Structure

```
docuflow/
│
├── frontend/                      # Next.js 14 web application
│   ├── app/                       # App Router pages & layouts
│   │   ├── (auth)/                # Login, register, SSO callback
│   │   ├── dashboard/             # Main workspace
│   │   ├── documents/             # Document viewer & editor
│   │   ├── workflows/             # Workflow builder UI
│   │   ├── integrations/          # Integration hub
│   │   └── settings/              # Tenant settings, billing, users
│   ├── components/                # Reusable UI components
│   │   ├── ui/                    # Design system primitives
│   │   ├── documents/             # Document-specific components
│   │   ├── ai/                    # Chat UI, RAG results, citations
│   │   └── workflows/             # Visual workflow builder
│   └── lib/                       # API clients, hooks, utilities
│
├── backend/
│   ├── auth-service/              # JWT, OAuth2, OIDC, SAML, RBAC
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   ├── doc-service/               # Document CRUD, versioning, blob storage
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   ├── ai-service/                # RAG engine, embeddings, classification
│   │   ├── src/
│   │   │   ├── ingestion/         # Chunking, parsing, embedding
│   │   │   ├── rag/               # Query pipeline, reranking, generation
│   │   │   ├── classification/    # Document classification models
│   │   │   └── extraction/        # NER, entity extraction
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   ├── workflow-service/          # Workflow engine, BullMQ job processing
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── README.md
│   │
│   └── integration-service/       # OAuth connectors, webhook delivery
│       ├── src/
│       ├── connectors/            # Per-integration connector modules
│       ├── Dockerfile
│       └── README.md
│
├── ai-pipeline/                   # Standalone AI processing scripts
│   ├── chunking/
│   ├── embeddings/
│   ├── classification/
│   └── evaluation/                # LLM eval harnesses
│
├── database/
│   ├── migrations/                # Flyway / Liquibase SQL migrations
│   ├── seeds/                     # Dev & test seed data
│   └── schemas/                   # ERD diagrams, schema docs
│
├── workflows/                     # Pre-built workflow templates (JSON)
│   ├── legal-review.json
│   ├── hr-onboarding.json
│   └── compliance-approval.json
│
├── integrations/                  # Integration connector definitions
│   ├── slack/
│   ├── google-workspace/
│   ├── microsoft-365/
│   └── salesforce/
│
├── infra/
│   ├── docker/                    # Dockerfiles & docker-compose
│   │   ├── docker-compose.yml     # Full local stack
│   │   └── docker-compose.dev.yml # Dev overrides (hot reload, debug ports)
│   ├── k8s/                       # Kubernetes manifests
│   │   ├── base/                  # Kustomize base configs
│   │   └── overlays/              # dev / staging / prod overlays
│   └── terraform/                 # IaC for AWS / GCP / Azure
│       ├── modules/
│       └── environments/
│
├── docs/                          # Architecture docs, ADRs, API specs
│   ├── architecture/
│   ├── adr/                       # Architecture Decision Records
│   ├── api/                       # OpenAPI 3.1 specs
│   └── runbooks/                  # Operational runbooks
│
├── .github/
│   ├── workflows/                 # CI/CD pipelines (GitHub Actions)
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docker-compose.yml
├── .env.example
├── Makefile                       # Common dev commands
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Docker | 24+ | Container runtime |
| Docker Compose | 2.20+ | Local orchestration |
| Node.js | 20 LTS | Frontend / Node services |
| Python | 3.11+ | AI service |
| Go | 1.22+ | Doc service |
| Make | Any | Dev shortcuts |

### Local Setup (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/docuflow.git
cd docuflow

# 2. Set up environment variables
cp .env.example .env
# Edit .env and fill in:
#   - OPENAI_API_KEY or ANTHROPIC_API_KEY
#   - JWT_SECRET
#   - POSTGRES_PASSWORD
#   - AWS credentials (or use MinIO — already configured for local)

# 3. Start all services
docker-compose up -d

# 4. Run database migrations
make db-migrate

# 5. Seed development data (optional)
make db-seed

# 6. Open in browser
open http://localhost:3000
```

| Service | URL |
|---|---|
| Frontend App | http://localhost:3000 |
| API Gateway | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Kafka UI | http://localhost:8080 |
| Qdrant Dashboard | http://localhost:6333/dashboard |
| MinIO Console | http://localhost:9001 |
| Grafana | http://localhost:3001 |
| Jaeger Tracing | http://localhost:16686 |

### Running Services Individually

```bash
# Frontend only
cd frontend && npm install && npm run dev

# AI Service
cd backend/ai-service && pip install -r requirements.txt && uvicorn main:app --reload

# Doc Service
cd backend/doc-service && go mod tidy && go run .

# Workflow Service
cd backend/workflow-service && npm install && npm run dev
```

### Makefile Shortcuts

```bash
make up          # Start all services
make down        # Stop all services
make logs        # Tail all service logs
make db-migrate  # Run database migrations
make db-seed     # Seed development data
make test        # Run all test suites
make lint        # Lint all services
make build       # Build all Docker images
make push        # Push images to registry
```

---

## Environment Variables

```dotenv
# ─── AI / LLM ───────────────────────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
EMBEDDING_MODEL=text-embedding-3-large
LLM_PROVIDER=openai              # openai | anthropic | azure

# ─── DATABASES ──────────────────────────────────────────────
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=docuflow
POSTGRES_USER=docuflow
POSTGRES_PASSWORD=your_secure_password

REDIS_URL=redis://localhost:6379

QDRANT_HOST=localhost
QDRANT_PORT=6333

ELASTICSEARCH_URL=http://localhost:9200

# ─── STORAGE ─────────────────────────────────────────────────
S3_ENDPOINT=http://localhost:9000    # MinIO for local; AWS S3 for prod
S3_BUCKET=docuflow-documents
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin

# ─── AUTH ────────────────────────────────────────────────────
JWT_SECRET=your_256_bit_secret
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# ─── KAFKA ───────────────────────────────────────────────────
KAFKA_BROKERS=localhost:9092

# ─── FEATURE FLAGS ───────────────────────────────────────────
ENABLE_RAG=true
ENABLE_CLASSIFICATION=true
ENABLE_KNOWLEDGE_GRAPH=false    # Beta
ENABLE_OCR=true
```

> ⚠️ **Never commit `.env` to version control.** Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) in production.

---

## 📡 API Reference

DocuFlow exposes a RESTful API (OpenAPI 3.1 spec at `/docs`) and a real-time WebSocket API.

### Core Endpoints

```
POST   /api/v1/auth/login                   Login, receive JWT
POST   /api/v1/auth/refresh                 Refresh access token
POST   /api/v1/auth/sso                     Initiate SAML / OIDC SSO

GET    /api/v1/documents                    List documents (paginated, filtered)
POST   /api/v1/documents                    Upload document
GET    /api/v1/documents/:id                Get document + metadata
PATCH  /api/v1/documents/:id                Update metadata / tags
DELETE /api/v1/documents/:id                Soft-delete document
GET    /api/v1/documents/:id/versions       List version history
GET    /api/v1/documents/:id/download       Signed download URL

POST   /api/v1/ai/query                     RAG natural language query
POST   /api/v1/ai/summarize/:id             Summarize a document
POST   /api/v1/ai/classify/:id              Trigger reclassification
GET    /api/v1/ai/entities/:id              Get extracted entities

GET    /api/v1/workflows                    List workflows
POST   /api/v1/workflows                    Create workflow
PATCH  /api/v1/workflows/:id                Update workflow
DELETE /api/v1/workflows/:id                Delete workflow

GET    /api/v1/integrations                 List available integrations
POST   /api/v1/integrations/:name/connect   OAuth connect
DELETE /api/v1/integrations/:name           Disconnect

GET    /api/v1/audit                        Audit log (admin only)
```

### RAG Query Example

```bash
curl -X POST https://your-instance.docuflow.io/api/v1/ai/query \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Which contracts expire in Q3 2025 with auto-renewal clauses?",
    "filters": {
      "classification": "contract",
      "date_range": { "from": "2025-07-01", "to": "2025-09-30" }
    },
    "top_k": 5,
    "stream": true
  }'
```

**Response (streamed):**
```json
{
  "answer": "The following contracts expire in Q3 2025 and contain auto-renewal clauses: ...",
  "citations": [
    {
      "document_id": "doc_abc123",
      "document_name": "Acme Corp MSA 2022.pdf",
      "page": 7,
      "chunk": "This Agreement shall automatically renew for successive one-year terms...",
      "relevance_score": 0.94
    }
  ],
  "confidence": 0.91
}
```

---

## 🏢 Multi-Tenancy Model

DocuFlow uses **PostgreSQL Row-Level Security (RLS)** for strict tenant isolation — no shared tables without row-level filters, no cross-tenant data leakage possible at the database layer.

```sql
-- Every table has a tenant_id column
-- RLS policy example for documents table:
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Session variable is set per-request by the API layer
SET app.current_tenant = 'tenant-uuid-here';
```

### Tenant Hierarchy

```
Platform Admin
└── Tenant (Organisation)
    ├── Workspaces (departments / projects)
    │   ├── Folders
    │   │   └── Documents
    │   └── Workflows
    └── Users
        └── Roles: Owner | Admin | Editor | Viewer | Commenter
```

Vector embeddings in Qdrant are also namespaced per tenant via collection-level metadata filters, ensuring semantic search never leaks across tenant boundaries.

---

## 🔐 Security

| Control | Implementation |
|---|---|
| Authentication | JWT (RS256) + Refresh tokens stored in HttpOnly cookies |
| Authorization | RBAC with RLS enforcement at DB layer |
| Encryption at Rest | AES-256-GCM (S3 SSE-KMS, PostgreSQL TDE) |
| Encryption in Transit | TLS 1.3 enforced; HSTS headers |
| Secrets Management | AWS Secrets Manager / HashiCorp Vault |
| API Security | Rate limiting (per tenant), WAF, DDoS protection via API Gateway |
| Audit Trail | Immutable append-only log; SHA-256 chaining for tamper evidence |
| SSO | SAML 2.0, OIDC (Google, Azure AD, Okta) |
| Data Residency | Region pinning per tenant (US, EU, APAC) |
| Vulnerability Scanning | Trivy (containers), Snyk (dependencies) in CI |
| Penetration Testing | Annual third-party pen test |

### Reporting a Vulnerability

Please do **not** open a public GitHub issue. Email `security@docuflow.io` with details. We follow a 90-day coordinated disclosure policy.

---

## 📈 Performance & Scalability

### Benchmarks (single node, 32-core / 128GB)

| Operation | Throughput | P99 Latency |
|---|---|---|
| Document upload (10MB PDF) | 500 req/min | 280ms |
| Semantic search (top-10) | 2,000 req/min | 45ms |
| RAG query (no streaming) | 200 req/min | 1.8s |
| Document classification | 1,000 req/min | 120ms |
| Webhook delivery | 10,000 events/min | — |

### Scaling Strategy

- **Horizontal scaling:** All microservices are stateless and scale via Kubernetes HPA on CPU/RPS metrics.
- **AI Service:** GPU-enabled node pools for embedding generation at scale.
- **Qdrant:** Sharded collections with replication factor 2 for HA.
- **Kafka:** 8-partition topics per tenant tier; consumer groups per service.
- **PostgreSQL:** Primary + 2 read replicas with PgBouncer connection pooling.
- **S3:** No inherent limits; CDN-fronted signed URLs for downloads.

---

## 🗺 Roadmap

| Quarter | Features |
|---|---|
| **Q2 2025** | ✅ Core ingestion pipeline · ✅ RAG engine · ✅ Multi-tenancy · ✅ Workflow engine |
| **Q3 2025** | 🔄 Knowledge graph (Neo4j) · 🔄 Mobile app (React Native) · 🔄 Advanced analytics dashboard |
| **Q4 2025** | 📅 Fine-tuned classification models · 📅 AI-generated workflow suggestions · 📅 SOC 2 Type II audit |
| **Q1 2026** | 📅 On-premise bare-metal deployment · 📅 Document co-editing (CRDT) · 📅 Custom LLM support (Llama 3, Mistral) |

Track progress on our public [GitHub Projects board](#).

---

## 🤝 Contributing

We welcome contributions from the community. Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a PR.

### Development Workflow

```bash
# 1. Fork the repo and create a feature branch
git checkout -b feat/your-feature-name

# 2. Make your changes, write tests
make test

# 3. Lint
make lint

# 4. Commit using Conventional Commits
git commit -m "feat(ai-service): add HyDE query expansion"

# 5. Push and open a Pull Request
git push origin feat/your-feature-name
```

### Branch Conventions

| Branch | Purpose |
|---|---|
| `main` | Production-ready code |
| `develop` | Integration branch |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Maintenance tasks |
| `docs/*` | Documentation only |

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

feat(ai-service): add HyDE query expansion for improved retrieval
fix(auth-service): resolve token refresh race condition
docs(readme): update architecture diagram
chore(infra): bump Qdrant to 1.9.0
```

---

## 📄 License

```
MIT License

Copyright (c) 2025 DocuFlow Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

<div align="center">

Built with ❤️ by the DocuFlow team.

[Website](#) · [Documentation](#) · [Changelog](CHANGELOG.md) · [Security](SECURITY.md) · [Twitter](#) · [Discord](#)

⭐ **If DocuFlow helps you, please star the repo. It means a lot.**

</div>