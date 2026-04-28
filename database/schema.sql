-- ============================================================
-- DocuFlow Enterprise Schema
-- Multi-tenant, AI-native document intelligence platform
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ─── TENANTS & ORGANIZATIONS ────────────────────────────────

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          VARCHAR(64) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  plan          VARCHAR(32) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  status        VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  settings      JSONB NOT NULL DEFAULT '{}',
  -- AI settings per tenant
  ai_model      VARCHAR(64) DEFAULT 'claude-sonnet-4-20250514',
  ai_budget_usd NUMERIC(10,2) DEFAULT 100.00,
  -- Storage quotas
  storage_limit_gb  INTEGER DEFAULT 10,
  storage_used_gb   NUMERIC(10,4) DEFAULT 0,
  -- Encryption
  encryption_key_id VARCHAR(255),  -- AWS KMS key ID
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_domains (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain     VARCHAR(255) UNIQUE NOT NULL,
  verified   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── USERS & AUTH ────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  email_verified  BOOLEAN DEFAULT FALSE,
  name            VARCHAR(255),
  avatar_url      TEXT,
  password_hash   TEXT,
  role            VARCHAR(32) NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','editor','viewer','guest')),
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  last_seen_at    TIMESTAMPTZ,
  preferences     JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE oauth_accounts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      VARCHAR(32) NOT NULL,  -- google, microsoft, github
  provider_id   VARCHAR(255) NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  token_expiry  TIMESTAMPTZ,
  scope         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_id)
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash    VARCHAR(64) UNIQUE NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── SPACES (like Google Drive Shared Drives) ────────────────

CREATE TABLE spaces (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  icon         VARCHAR(64),
  color        VARCHAR(32),
  type         VARCHAR(32) DEFAULT 'team' CHECK (type IN ('personal','team','public')),
  created_by   UUID NOT NULL REFERENCES users(id),
  settings     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE space_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(32) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','editor','commenter','viewer')),
  added_by   UUID REFERENCES users(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, user_id)
);

-- ─── DOCUMENTS ────────────────────────────────────────────────

CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  space_id         UUID REFERENCES spaces(id) ON DELETE SET NULL,
  parent_id        UUID REFERENCES documents(id) ON DELETE SET NULL,
  name             VARCHAR(1024) NOT NULL,
  description      TEXT,
  doc_type         VARCHAR(64) NOT NULL DEFAULT 'file',  -- file, folder, note, wiki
  mime_type        VARCHAR(128),
  extension        VARCHAR(32),
  -- Storage
  storage_key      TEXT,   -- S3 key
  storage_size     BIGINT DEFAULT 0,
  checksum         VARCHAR(64),
  -- AI metadata
  ai_summary       TEXT,
  ai_category      VARCHAR(128),
  ai_tags          TEXT[] DEFAULT '{}',
  ai_language      VARCHAR(32),
  ai_sentiment     VARCHAR(32),
  ai_entities      JSONB DEFAULT '[]',
  ai_processed_at  TIMESTAMPTZ,
  embedding_id     VARCHAR(128),  -- Qdrant point ID
  -- Version info
  version          INTEGER NOT NULL DEFAULT 1,
  is_latest        BOOLEAN NOT NULL DEFAULT TRUE,
  -- Status
  status           VARCHAR(32) DEFAULT 'active' CHECK (status IN ('active','archived','trashed','processing')),
  is_locked        BOOLEAN DEFAULT FALSE,
  locked_by        UUID REFERENCES users(id),
  -- Ownership
  created_by       UUID NOT NULL REFERENCES users(id),
  updated_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  trashed_at       TIMESTAMPTZ
);

-- Full-text + trigram search index
CREATE INDEX idx_docs_fts ON documents USING GIN (
  to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(ai_summary,''))
);
CREATE INDEX idx_docs_tags ON documents USING GIN (ai_tags);
CREATE INDEX idx_docs_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_docs_space ON documents(space_id);
CREATE INDEX idx_docs_parent ON documents(parent_id);

CREATE TABLE document_versions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  storage_key  TEXT,
  size         BIGINT,
  checksum     VARCHAR(64),
  change_note  TEXT,
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_metadata (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key          VARCHAR(256) NOT NULL,
  value        TEXT,
  source       VARCHAR(32) DEFAULT 'user' CHECK (source IN ('user','ai','system','integration')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, key)
);

-- ─── ACCESS CONTROL ────────────────────────────────────────

CREATE TABLE document_permissions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  principal_type VARCHAR(32) NOT NULL CHECK (principal_type IN ('user','group','role','public')),
  principal_id UUID,  -- NULL for public
  permission   VARCHAR(32) NOT NULL CHECK (permission IN ('view','comment','edit','manage','owner')),
  conditions   JSONB DEFAULT '{}',  -- ABAC conditions
  granted_by   UUID REFERENCES users(id),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(255) NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- ─── AI CONVERSATIONS (Ask Your Docs / RAG) ─────────────────

CREATE TABLE ai_conversations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  space_id    UUID REFERENCES spaces(id),
  title       VARCHAR(512),
  context     JSONB DEFAULT '{}',  -- pinned docs, filters
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            VARCHAR(32) NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  -- RAG sources
  sources         JSONB DEFAULT '[]',  -- [{doc_id, chunk_id, score, excerpt}]
  -- Cost tracking
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  model           VARCHAR(64),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── KNOWLEDGE GRAPH ─────────────────────────────────────────

CREATE TABLE document_relations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  target_doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  relation_type VARCHAR(64) NOT NULL,  -- references, similar_to, derived_from, part_of, contradicts
  confidence    NUMERIC(4,3) DEFAULT 1.0,
  source        VARCHAR(32) DEFAULT 'ai',  -- ai, user
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_doc_id, target_doc_id, relation_type)
);

-- ─── WORKFLOWS ────────────────────────────────────────────────

CREATE TABLE workflows (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  trigger     JSONB NOT NULL,  -- {type: 'document.uploaded', filters: {...}}
  steps       JSONB NOT NULL DEFAULT '[]',  -- workflow DAG
  is_active   BOOLEAN DEFAULT TRUE,
  run_count   INTEGER DEFAULT 0,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workflow_runs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id  UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_data JSONB DEFAULT '{}',
  status       VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending','running','success','failed','cancelled')),
  steps_log    JSONB DEFAULT '[]',  -- step-by-step execution log
  error        TEXT,
  started_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE approval_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_run_id UUID REFERENCES workflow_runs(id),
  document_id  UUID REFERENCES documents(id),
  requester_id UUID NOT NULL REFERENCES users(id),
  approver_id  UUID NOT NULL REFERENCES users(id),
  status       VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  comment      TEXT,
  due_at       TIMESTAMPTZ,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INTEGRATIONS ─────────────────────────────────────────────

CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type          VARCHAR(64) NOT NULL,  -- google_drive, dropbox, slack, salesforce
  name          VARCHAR(255),
  status        VARCHAR(32) DEFAULT 'active',
  credentials   JSONB,  -- encrypted at app level before storing
  settings      JSONB DEFAULT '{}',
  last_sync_at  TIMESTAMPTZ,
  sync_cursor   TEXT,  -- pagination token for incremental sync
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE integration_events (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type     VARCHAR(128) NOT NULL,
  payload        JSONB NOT NULL,
  status         VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending','processing','success','failed','retrying')),
  retries        INTEGER DEFAULT 0,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at   TIMESTAMPTZ
);

-- ─── AUDIT LOGS ────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(128) NOT NULL,  -- document.view, document.download, etc.
  resource    VARCHAR(64),
  resource_id UUID,
  metadata    JSONB DEFAULT '{}',
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource, resource_id);

-- ─── NOTIFICATIONS ─────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(128) NOT NULL,
  title       VARCHAR(512) NOT NULL,
  body        TEXT,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ─── AI USAGE TRACKING ─────────────────────────────────────────

CREATE TABLE ai_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id),
  feature       VARCHAR(64) NOT NULL,  -- rag, summarize, classify, extract
  model         VARCHAR(64),
  input_tokens  INTEGER,
  output_tokens INTEGER,
  cost_usd      NUMERIC(10,6),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN FOR t IN SELECT unnest(ARRAY['tenants','users','spaces','documents','workflows','ai_conversations']) LOOP
  EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
END LOOP; END $$;

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (app sets tenant_id in session variable)
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON spaces
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

CREATE POLICY tenant_isolation ON notifications
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
