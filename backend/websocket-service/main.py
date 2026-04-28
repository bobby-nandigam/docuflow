"""
DocuFlow WebSocket Service
- Real-time push notifications to browser clients
- Tenant-scoped channels
- Consumes from Kafka and pushes to connected clients
- Powers live document status updates, collaboration, notifications
"""

import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Dict, Set

import asyncpg
import jwt
from aiokafka import AIOKafkaConsumer
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.websockets import WebSocketState

DB_URL = os.getenv("DATABASE_URL")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:9092")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")

# ─── CONNECTION MANAGER ──────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        # tenant_id → set of (user_id, websocket)
        self._tenant_connections: Dict[str, Set[tuple]] = {}
        # user_id → websocket
        self._user_connections: Dict[str, WebSocket] = {}

    def connect(self, tenant_id: str, user_id: str, ws: WebSocket):
        if tenant_id not in self._tenant_connections:
            self._tenant_connections[tenant_id] = set()
        self._tenant_connections[tenant_id].add((user_id, ws))
        self._user_connections[user_id] = ws
        print(f"[WS] Connected: user={user_id} tenant={tenant_id} | "
              f"Total: {self.total_connections}")

    def disconnect(self, tenant_id: str, user_id: str):
        if tenant_id in self._tenant_connections:
            self._tenant_connections[tenant_id] = {
                (uid, ws) for uid, ws in self._tenant_connections[tenant_id]
                if uid != user_id
            }
            if not self._tenant_connections[tenant_id]:
                del self._tenant_connections[tenant_id]
        self._user_connections.pop(user_id, None)
        print(f"[WS] Disconnected: user={user_id} | Total: {self.total_connections}")

    async def send_to_user(self, user_id: str, message: dict):
        ws = self._user_connections.get(user_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_to_tenant(self, tenant_id: str, message: dict, exclude_user: str = None):
        connections = self._tenant_connections.get(tenant_id, set())
        dead = []
        for user_id, ws in connections:
            if user_id == exclude_user:
                continue
            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append((user_id, ws))
            else:
                dead.append((user_id, ws))

        # Cleanup dead connections
        for user_id, ws in dead:
            self.disconnect(tenant_id, user_id)

    @property
    def total_connections(self):
        return len(self._user_connections)

manager = ConnectionManager()

# ─── KAFKA CONSUMER ──────────────────────────────────────────

BROADCAST_TOPICS = [
    "document.uploaded",
    "ai.completed",
    "workflow.completed",
    "notification.send",
    "integration.sync",
]

async def kafka_to_websocket():
    """Consume Kafka events and push to WebSocket clients"""
    consumer = AIOKafkaConsumer(
        *BROADCAST_TOPICS,
        bootstrap_servers=KAFKA_BROKERS,
        group_id="websocket-broadcaster",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="latest",  # Only new events for live clients
    )
    await consumer.start()
    try:
        async for msg in consumer:
            event = msg.value
            tenant_id = event.get("tenant_id")
            if not tenant_id:
                continue

            # Map Kafka topic to WS event type
            ws_event = {
                "type": msg.topic,
                "data": event,
                "timestamp": event.get("timestamp"),
            }

            # Route to correct clients
            if msg.topic == "notification.send":
                user_id = event.get("user_id")
                if user_id:
                    await manager.send_to_user(user_id, ws_event)
            else:
                # Broadcast to all tenant members
                uploader = event.get("user_id")
                await manager.broadcast_to_tenant(tenant_id, ws_event, exclude_user=None)

    finally:
        await consumer.stop()

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(kafka_to_websocket())
    yield

app = FastAPI(title="DocuFlow WebSocket Service", lifespan=lifespan)

# ─── WEBSOCKET ENDPOINT ──────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    # Verify JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
        tenant_id = payload["tid"]
    except jwt.InvalidTokenError:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()
    manager.connect(tenant_id, user_id, websocket)

    # Send initial connection confirmation
    await websocket.send_json({
        "type": "connected",
        "data": {"user_id": user_id, "tenant_id": tenant_id},
    })

    try:
        while True:
            # Keep connection alive + handle client messages
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg.get("type") == "subscribe_document":
                # Client subscribes to a specific document's updates
                await websocket.send_json({
                    "type": "subscribed",
                    "data": {"document_id": msg.get("document_id")}
                })

    except WebSocketDisconnect:
        manager.disconnect(tenant_id, user_id)
    except Exception as e:
        print(f"[WS] Error for user {user_id}: {e}")
        manager.disconnect(tenant_id, user_id)

@app.get("/ws/stats")
async def ws_stats():
    return {"total_connections": manager.total_connections}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8060, ws_ping_interval=20, ws_ping_timeout=20)
