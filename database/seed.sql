-- ============================================================
-- DocuFlow Seed Data — Development / Demo
-- ============================================================

-- Demo tenant
INSERT INTO tenants (id, slug, name, plan, ai_model) VALUES
  ('00000000-0000-0000-0000-000000000001', 'acme-corp', 'Acme Corporation', 'enterprise', 'claude-sonnet-4-20250514');

-- Demo users
INSERT INTO users (id, tenant_id, email, name, password_hash, role, email_verified) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'admin@acme.com', 'John Doe', '$2b$12$demo_hash_here', 'owner', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'jane@acme.com', 'Jane Smith', '$2b$12$demo_hash_here', 'editor', true),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'legal@acme.com', 'Legal Team', '$2b$12$demo_hash_here', 'editor', true);

-- Demo spaces
INSERT INTO spaces (id, tenant_id, name, description, icon, type, created_by) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'Product Docs', 'Product documentation and specs', '📦', 'team', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'Legal & Contracts', 'Contracts, agreements, policies', '⚖️', 'team', '00000000-0000-0000-0000-000000000010'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'Marketing', 'Campaigns, briefs, assets', '📣', 'team', '00000000-0000-0000-0000-000000000010');

-- Space memberships
INSERT INTO space_members (space_id, user_id, role) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000010', 'owner'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000011', 'editor'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000010', 'owner'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000012', 'editor'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000010', 'owner'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000011', 'editor');

-- Example workflow
INSERT INTO workflows (id, tenant_id, name, description, trigger, steps, is_active, created_by) VALUES
  ('00000000-0000-0000-0002-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'Auto-classify Legal Documents',
   'Automatically tag and route legal documents for review',
   '{"type": "document.uploaded", "filters": {}}',
   '[
     {"id": "s1", "type": "condition", "name": "Is it a contract?",
      "config": {"field": "ai_category", "operator": "equals", "value": "contract"},
      "on_condition_true": "s2", "on_condition_false": null},
     {"id": "s2", "type": "tag", "name": "Add legal tags",
      "config": {"tags": ["legal", "review-needed", "contract"]},
      "next_step": "s3"},
     {"id": "s3", "type": "notification", "name": "Notify legal team",
      "config": {"channel": "email", "recipients": ["legal@acme.com"],
                 "template": "New contract {document_name} requires legal review"}}
   ]',
   true,
   '00000000-0000-0000-0000-000000000010');

-- Example notifications
INSERT INTO notifications (tenant_id, user_id, type, title, body, data) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'approval.requested', 'Document Approval Required',
   'Q4 Financial Report.pdf is awaiting your approval',
   '{"document_id": "doc-001"}'),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010',
   'ai.insight', 'AI Found Action Items',
   '3 documents uploaded today contain action items that need attention',
   '{}');
