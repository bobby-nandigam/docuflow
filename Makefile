.PHONY: dev build stop logs clean test seed

# ─── DEVELOPMENT ─────────────────────────────────────────────

dev:
	@echo "🚀 Starting DocuFlow development environment..."
	docker-compose up -d
	@echo "✅ All services started"
	@echo ""
	@echo "  📱 Frontend:    http://localhost:3000"
	@echo "  🔌 API Docs:    http://localhost:8010/docs (auth)"
	@echo "                  http://localhost:8020/docs (docs)"
	@echo "                  http://localhost:8030/docs (ai)"
	@echo "                  http://localhost:8040/docs (workflows)"
	@echo "                  http://localhost:8050/docs (integrations)"
	@echo "  📊 Kafka UI:    http://localhost:8080"
	@echo "  📈 Grafana:     http://localhost:3001  (admin/admin)"
	@echo "  💾 MinIO:       http://localhost:9001  (docuflow/secret123)"
	@echo "  🔍 Prometheus:  http://localhost:9090"

stop:
	docker-compose down

build:
	docker-compose build --parallel

# ─── LOGS ────────────────────────────────────────────────────

logs:
	docker-compose logs -f --tail=50

logs-ai:
	docker-compose logs -f ai-service

logs-backend:
	docker-compose logs -f auth-service doc-service workflow-service

# ─── DATABASE ────────────────────────────────────────────────

seed:
	docker-compose exec postgres psql -U docuflow -d docuflow -f /docker-entrypoint-initdb.d/02-seed.sql
	@echo "✅ Database seeded"

migrate:
	docker-compose exec postgres psql -U docuflow -d docuflow -f /docker-entrypoint-initdb.d/01-schema.sql
	@echo "✅ Schema applied"

db-shell:
	docker-compose exec postgres psql -U docuflow -d docuflow

# ─── TESTING ─────────────────────────────────────────────────

test:
	@echo "🧪 Running tests..."
	docker-compose exec auth-service pytest tests/ -v
	docker-compose exec doc-service pytest tests/ -v
	docker-compose exec ai-service pytest tests/ -v

test-api:
	@echo "🔌 Testing API endpoints..."
	# Register
	curl -X POST http://localhost:8010/auth/register \
	  -H "Content-Type: application/json" \
	  -d '{"email":"test@test.com","password":"test123","name":"Test User","tenant_slug":"test-co"}' | jq .

# ─── CLEAN ───────────────────────────────────────────────────

clean:
	docker-compose down -v --remove-orphans
	@echo "✅ All containers and volumes removed"

clean-images:
	docker-compose down --rmi all
	@echo "✅ All images removed"

# ─── PRODUCTION ──────────────────────────────────────────────

deploy-k8s:
	kubectl apply -f infra/k8s-deployment.yaml
	kubectl rollout status deployment/doc-service -n docuflow

infra-plan:
	cd infra/terraform && terraform plan

infra-apply:
	cd infra/terraform && terraform apply

# ─── HEALTH CHECK ────────────────────────────────────────────

health:
	@echo "Checking service health..."
	@curl -sf http://localhost:8010/health && echo "✅ auth-service" || echo "❌ auth-service"
	@curl -sf http://localhost:8020/health && echo "✅ doc-service" || echo "❌ doc-service"
	@curl -sf http://localhost:8030/health && echo "✅ ai-service" || echo "❌ ai-service"
	@curl -sf http://localhost:8040/health && echo "✅ workflow-service" || echo "❌ workflow-service"
	@curl -sf http://localhost:8050/health && echo "✅ integration-service" || echo "❌ integration-service"
