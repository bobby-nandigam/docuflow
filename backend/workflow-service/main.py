"""
DocuFlow Workflow Engine Service
- No-code/low-code workflow builder backend
- Conditional logic execution
- Approval pipelines
- Notification dispatch
- Audit logging per step
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncpg, redis.asyncio as aioredis
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
import json, uuid, asyncio, os
from datetime import datetime, timezone
from contextlib import asynccontextmanager
import httpx

DB_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DB_URL, min_size=3, max_size=15)
    app.state.redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    app.state.kafka_producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BROKERS,
        value_serializer=lambda v: json.dumps(v).encode()
    )
    await app.state.kafka_producer.start()
    asyncio.create_task(consume_events(app))
    yield
    await app.state.db.close()
    await app.state.redis.aclose()
    await app.state.kafka_producer.stop()

app = FastAPI(title="DocuFlow Workflow Service", version="1.0.0", lifespan=lifespan)

# ─── STEP TYPES ──────────────────────────────────────────────

STEP_TYPES = {
    "notification": "Send email/Slack notification",
    "approval": "Request document approval",
    "tag": "Add tags to document",
    "move": "Move document to folder",
    "share": "Share document with users",
    "webhook": "Call external webhook",
    "condition": "Conditional branch (IF/THEN)",
    "ai_summarize": "AI: Generate summary",
    "ai_classify": "AI: Classify document",
    "delay": "Wait for N minutes",
}

TRIGGER_TYPES = {
    "document.uploaded": "Document uploaded",
    "document.updated": "Document updated",
    "document.shared": "Document shared",
    "approval.requested": "Approval requested",
    "approval.completed": "Approval completed",
    "schedule.cron": "Scheduled (cron)",
    "manual": "Manually triggered",
}

# ─── MODELS ───────────────────────────────────────────────────

class WorkflowStep(BaseModel):
    id: str
    type: str
    name: str
    config: Dict[str, Any]
    next_step: Optional[str] = None
    on_condition_true: Optional[str] = None
    on_condition_false: Optional[str] = None

class WorkflowTrigger(BaseModel):
    type: str
    filters: Optional[Dict] = {}
    cron: Optional[str] = None

class CreateWorkflowRequest(BaseModel):
    name: str
    description: Optional[str] = None
    trigger: WorkflowTrigger
    steps: List[WorkflowStep]
    tenant_id: str
    user_id: str

# ─── STEP EXECUTOR ────────────────────────────────────────────

class StepExecutor:
    def __init__(self, app_state):
        self.app_state = app_state

    async def execute_step(self, step: dict, context: dict) -> dict:
        step_type = step["type"]
        config = step.get("config", {})
        result = {"status": "success", "output": {}}

        try:
            if step_type == "notification":
                result = await self.run_notification(config, context)

            elif step_type == "approval":
                result = await self.run_approval(config, context)

            elif step_type == "tag":
                result = await self.run_tag(config, context)

            elif step_type == "condition":
                result = await self.run_condition(config, context)

            elif step_type == "webhook":
                result = await self.run_webhook(config, context)

            elif step_type == "move":
                result = await self.run_move(config, context)

            elif step_type == "delay":
                await asyncio.sleep(config.get("minutes", 1) * 60)
                result = {"status": "success", "output": {"delayed_minutes": config.get("minutes", 1)}}

        except Exception as e:
            result = {"status": "failed", "error": str(e)}

        return result

    async def run_notification(self, config: dict, context: dict) -> dict:
        """Send email or Slack notification"""
        channel = config.get("channel", "email")
        recipients = config.get("recipients", [])
        template = config.get("template", "")

        # Resolve template variables
        message = template.format(
            document_name=context.get("document_name", ""),
            uploader=context.get("uploader_name", ""),
            tenant=context.get("tenant_name", ""),
        )

        if channel == "slack":
            webhook_url = config.get("webhook_url")
            if webhook_url:
                async with httpx.AsyncClient() as client:
                    await client.post(webhook_url, json={"text": message}, timeout=10)

        elif channel == "email":
            # In production: use SES/SendGrid
            print(f"[Email] To: {recipients} | Message: {message}")

        return {"status": "success", "output": {"channel": channel, "recipients": recipients}}

    async def run_approval(self, config: dict, context: dict) -> dict:
        """Create an approval request"""
        approver_id = config.get("approver_id")
        doc_id = context.get("document_id")
        run_id = context.get("run_id")

        if not approver_id or not doc_id:
            return {"status": "failed", "error": "Missing approver or document"}

        pool = self.app_state.db
        async with pool.acquire() as conn:
            approval = await conn.fetchrow(
                """INSERT INTO approval_requests
                   (tenant_id, workflow_run_id, document_id, requester_id, approver_id)
                   VALUES ($1,$2,$3,$4,$5) RETURNING id""",
                context["tenant_id"], run_id, doc_id, context["user_id"], approver_id
            )

            # Notify approver
            await conn.execute(
                """INSERT INTO notifications (tenant_id, user_id, type, title, body, data)
                   VALUES ($1,$2,'approval.requested','Document Approval Required',
                   $3, $4)""",
                context["tenant_id"], approver_id,
                f"Please review: {context.get('document_name', 'document')}",
                json.dumps({"approval_id": str(approval["id"]), "document_id": doc_id})
            )

        return {"status": "pending", "output": {"approval_id": str(approval["id"])}}

    async def run_condition(self, config: dict, context: dict) -> dict:
        """Evaluate IF/THEN condition"""
        field = config.get("field", "")
        operator = config.get("operator", "equals")
        value = config.get("value", "")

        actual = context.get(field, "")

        result = False
        if operator == "equals":
            result = str(actual).lower() == str(value).lower()
        elif operator == "contains":
            result = str(value).lower() in str(actual).lower()
        elif operator == "starts_with":
            result = str(actual).lower().startswith(str(value).lower())
        elif operator == "greater_than":
            result = float(actual or 0) > float(value or 0)
        elif operator == "in_list":
            result = str(actual).lower() in [v.strip().lower() for v in str(value).split(",")]

        return {"status": "success", "output": {"condition_result": result}}

    async def run_tag(self, config: dict, context: dict) -> dict:
        """Add tags to document"""
        tags = config.get("tags", [])
        doc_id = context.get("document_id")
        pool = self.app_state.db
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE documents SET ai_tags = ai_tags || $1 WHERE id=$2",
                tags, doc_id
            )
        return {"status": "success", "output": {"tags_added": tags}}

    async def run_webhook(self, config: dict, context: dict) -> dict:
        """Call external webhook"""
        url = config.get("url")
        method = config.get("method", "POST").upper()
        headers = config.get("headers", {})
        payload = {**context, **config.get("payload", {})}

        async with httpx.AsyncClient() as client:
            if method == "POST":
                r = await client.post(url, json=payload, headers=headers, timeout=30)
            else:
                r = await client.get(url, params=payload, headers=headers, timeout=30)

        return {
            "status": "success" if r.status_code < 400 else "failed",
            "output": {"status_code": r.status_code, "response": r.text[:500]}
        }

    async def run_move(self, config: dict, context: dict) -> dict:
        """Move document to different folder/space"""
        target_space_id = config.get("space_id")
        target_parent_id = config.get("parent_id")
        doc_id = context.get("document_id")
        pool = self.app_state.db
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE documents SET space_id=$1, parent_id=$2 WHERE id=$3",
                target_space_id, target_parent_id, doc_id
            )
        return {"status": "success", "output": {"moved_to_space": target_space_id}}

# ─── WORKFLOW RUNNER ──────────────────────────────────────────

async def run_workflow(app, workflow: dict, trigger_data: dict):
    """Execute a workflow given trigger context"""
    pool = app.state.db

    async with pool.acquire() as conn:
        run = await conn.fetchrow(
            """INSERT INTO workflow_runs (workflow_id, tenant_id, trigger_data, status, started_at)
               VALUES ($1,$2,$3,'running',now()) RETURNING id""",
            workflow["id"], workflow["tenant_id"],
            json.dumps(trigger_data, default=str)
        )
        run_id = str(run["id"])

    steps = workflow["steps"]
    if isinstance(steps, str):
        steps = json.loads(steps)

    executor = StepExecutor(app.state)
    context = {**trigger_data, "run_id": run_id, "tenant_id": str(workflow["tenant_id"])}
    steps_log = []
    current_step_id = steps[0]["id"] if steps else None
    step_map = {s["id"]: s for s in steps}
    overall_status = "success"

    while current_step_id:
        step = step_map.get(current_step_id)
        if not step:
            break

        start_time = datetime.now(timezone.utc)
        result = await executor.execute_step(step, context)
        end_time = datetime.now(timezone.utc)

        step_log = {
            "step_id": step["id"],
            "step_name": step.get("name"),
            "type": step["type"],
            "result": result,
            "duration_ms": int((end_time - start_time).total_seconds() * 1000),
            "timestamp": start_time.isoformat(),
        }
        steps_log.append(step_log)
        context.update(result.get("output", {}))

        if result["status"] == "failed":
            overall_status = "failed"
            break

        # Determine next step
        if step["type"] == "condition":
            if result["output"].get("condition_result"):
                current_step_id = step.get("on_condition_true")
            else:
                current_step_id = step.get("on_condition_false")
        else:
            current_step_id = step.get("next_step")

    # Update run status
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE workflow_runs SET status=$1, steps_log=$2, finished_at=now()
               WHERE id=$3""",
            overall_status, json.dumps(steps_log), run_id
        )
        await conn.execute(
            "UPDATE workflows SET run_count = run_count+1 WHERE id=$1", workflow["id"]
        )

    return run_id, overall_status

# ─── KAFKA EVENT CONSUMER ─────────────────────────────────────

WATCHED_TOPICS = list(TRIGGER_TYPES.keys())

async def consume_events(app):
    consumer = AIOKafkaConsumer(
        *[t for t in WATCHED_TOPICS if t != "manual" and t != "schedule.cron"],
        bootstrap_servers=KAFKA_BROKERS,
        group_id="workflow-engine",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
    )
    await consumer.start()
    try:
        async for msg in consumer:
            event = msg.value
            tenant_id = event.get("tenant_id")
            event_type = event.get("event", msg.topic)

            if not tenant_id:
                continue

            # Find matching workflows
            async with app.state.db.acquire() as conn:
                workflows = await conn.fetch(
                    """SELECT * FROM workflows
                       WHERE tenant_id=$1 AND is_active=TRUE
                       AND (trigger->>'type') = $2""",
                    tenant_id, event_type
                )
            for wf in workflows:
                asyncio.create_task(run_workflow(app, dict(wf), event))
    finally:
        await consumer.stop()

# ─── ROUTES ───────────────────────────────────────────────────

@app.post("/workflows")
async def create_workflow(req: CreateWorkflowRequest):
    pool = app.state.db
    async with pool.acquire() as conn:
        wf = await conn.fetchrow(
            """INSERT INTO workflows (tenant_id, name, description, trigger, steps, created_by)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING *""",
            req.tenant_id, req.name, req.description,
            req.trigger.model_dump_json(),
            json.dumps([s.model_dump() for s in req.steps]),
            req.user_id
        )
    return dict(wf)

@app.get("/workflows")
async def list_workflows(tenant_id: str):
    pool = app.state.db
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM workflows WHERE tenant_id=$1 ORDER BY created_at DESC",
            tenant_id
        )
    return [dict(r) for r in rows]

@app.post("/workflows/{workflow_id}/trigger")
async def manual_trigger(workflow_id: str, tenant_id: str, data: dict = {}):
    pool = app.state.db
    async with pool.acquire() as conn:
        wf = await conn.fetchrow(
            "SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2", workflow_id, tenant_id
        )
    if not wf:
        raise HTTPException(404)

    run_id, status = await run_workflow(app, dict(wf), {**data, "event": "manual"})
    return {"run_id": run_id, "status": status}

@app.get("/workflows/{workflow_id}/runs")
async def get_workflow_runs(workflow_id: str):
    pool = app.state.db
    async with pool.acquire() as conn:
        runs = await conn.fetch(
            "SELECT * FROM workflow_runs WHERE workflow_id=$1 ORDER BY created_at DESC LIMIT 50",
            workflow_id
        )
    return [dict(r) for r in runs]

@app.get("/step-types")
async def get_step_types():
    return {"trigger_types": TRIGGER_TYPES, "step_types": STEP_TYPES}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8040)
