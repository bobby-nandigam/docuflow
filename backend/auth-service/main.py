"""
DocuFlow Auth Service
- JWT token issuance & verification
- OAuth2 (Google, Microsoft, GitHub)
- Multi-tenant user management
- Session management
"""

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import asyncpg, redis.asyncio as redis
import jwt, bcrypt, uuid, json
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
import httpx, os

# ─── CONFIG ───────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGO = "HS256"
ACCESS_TOKEN_TTL = 3600       # 1 hour
REFRESH_TOKEN_TTL = 2592000   # 30 days
DB_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# ─── APP STARTUP ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.db = await asyncpg.create_pool(DB_URL, min_size=5, max_size=20)
    app.state.redis = await redis.from_url(REDIS_URL, decode_responses=True)
    yield
    await app.state.db.close()
    await app.state.redis.aclose()

app = FastAPI(title="DocuFlow Auth Service", version="1.0.0", lifespan=lifespan)
security = HTTPBearer()

# ─── MODELS ───────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    tenant_slug: str           # tenant to join or create
    invite_token: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_slug: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = ACCESS_TOKEN_TTL
    user: dict
    tenant: dict

class RefreshRequest(BaseModel):
    refresh_token: str

# ─── HELPERS ──────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(user_id: str, tenant_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "tid": tenant_id,  # tenant_id
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(seconds=ACCESS_TOKEN_TTL),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def create_refresh_token(user_id: str, tenant_id: str) -> str:
    payload = {
        "sub": user_id,
        "tid": tenant_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=REFRESH_TOKEN_TTL),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=None
):
    payload = decode_token(credentials.credentials)
    # Check token not revoked
    revoked = await app.state.redis.get(f"revoked_token:{payload['jti']}")
    if revoked:
        raise HTTPException(401, "Token revoked")
    return payload

# ─── ROUTES ────────────────────────────────────────────────────

@app.post("/auth/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    pool = app.state.db
    async with pool.acquire() as conn:
        # Get or create tenant
        tenant = await conn.fetchrow(
            "SELECT * FROM tenants WHERE slug = $1", req.tenant_slug
        )
        if not tenant:
            # Create new tenant
            tenant = await conn.fetchrow(
                """INSERT INTO tenants (slug, name) VALUES ($1, $2)
                   RETURNING *""",
                req.tenant_slug, req.tenant_slug.replace("-", " ").title()
            )
            role = "owner"
        else:
            # Joining existing tenant requires invite
            if not req.invite_token:
                raise HTTPException(400, "Invite token required to join existing tenant")
            # TODO: validate invite token
            role = "member"

        # Check user doesn't exist
        existing = await conn.fetchrow(
            "SELECT id FROM users WHERE tenant_id=$1 AND email=$2",
            tenant["id"], req.email
        )
        if existing:
            raise HTTPException(409, "Email already registered")

        # Create user
        user = await conn.fetchrow(
            """INSERT INTO users (tenant_id, email, name, password_hash, role)
               VALUES ($1, $2, $3, $4, $5) RETURNING *""",
            tenant["id"], req.email, req.name, hash_password(req.password), role
        )

    access = create_access_token(str(user["id"]), str(tenant["id"]), role)
    refresh = create_refresh_token(str(user["id"]), str(tenant["id"]))

    # Store session
    await app.state.redis.setex(
        f"session:{user['id']}", REFRESH_TOKEN_TTL,
        json.dumps({"user_id": str(user["id"]), "tenant_id": str(tenant["id"])})
    )

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": str(user["id"]), "email": user["email"], "name": user["name"], "role": role},
        tenant={"id": str(tenant["id"]), "slug": tenant["slug"], "name": tenant["name"], "plan": tenant["plan"]}
    )

@app.post("/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    pool = app.state.db
    async with pool.acquire() as conn:
        tenant = await conn.fetchrow(
            "SELECT * FROM tenants WHERE slug=$1 AND status='active'", req.tenant_slug
        )
        if not tenant:
            raise HTTPException(404, "Tenant not found")

        user = await conn.fetchrow(
            "SELECT * FROM users WHERE tenant_id=$1 AND email=$2 AND status='active'",
            tenant["id"], req.email
        )
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(401, "Invalid credentials")

        # Update last seen
        await conn.execute(
            "UPDATE users SET last_seen_at=now() WHERE id=$1", user["id"]
        )

        # Audit log
        await conn.execute(
            """INSERT INTO audit_logs (tenant_id, user_id, action, resource)
               VALUES ($1, $2, 'user.login', 'session')""",
            tenant["id"], user["id"]
        )

    access = create_access_token(str(user["id"]), str(tenant["id"]), user["role"])
    refresh = create_refresh_token(str(user["id"]), str(tenant["id"]))

    return TokenResponse(
        access_token=access,
        refresh_token=refresh,
        user={"id": str(user["id"]), "email": user["email"], "name": user["name"], "role": user["role"]},
        tenant={"id": str(tenant["id"]), "slug": tenant["slug"], "name": tenant["name"], "plan": tenant["plan"]}
    )

@app.post("/auth/refresh")
async def refresh_token(req: RefreshRequest):
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(400, "Not a refresh token")

    # Verify session exists
    session = await app.state.redis.get(f"session:{payload['sub']}")
    if not session:
        raise HTTPException(401, "Session expired")

    pool = app.state.db
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            "SELECT * FROM users WHERE id=$1 AND status='active'", payload["sub"]
        )
        if not user:
            raise HTTPException(401, "User not found")

    new_access = create_access_token(str(user["id"]), payload["tid"], user["role"])
    return {"access_token": new_access, "token_type": "bearer", "expires_in": ACCESS_TOKEN_TTL}

@app.post("/auth/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    # Revoke token
    ttl = int((datetime.fromtimestamp(payload["exp"], timezone.utc) - datetime.now(timezone.utc)).total_seconds())
    if ttl > 0:
        await app.state.redis.setex(f"revoked_token:{payload['jti']}", ttl, "1")
    # Delete session
    await app.state.redis.delete(f"session:{payload['sub']}")
    return {"message": "Logged out"}

@app.get("/auth/me")
async def get_me(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    pool = app.state.db
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            """SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.plan
               FROM users u JOIN tenants t ON u.tenant_id = t.id
               WHERE u.id=$1""", payload["sub"]
        )
    if not user:
        raise HTTPException(404, "User not found")
    return {
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "tenant": {
            "id": str(user["tenant_id"]),
            "name": user["tenant_name"],
            "slug": user["tenant_slug"],
            "plan": user["plan"],
        }
    }

# OAuth2 endpoints (Google, Microsoft)
@app.get("/auth/oauth/{provider}")
async def oauth_redirect(provider: str, tenant_slug: str):
    """Redirect to OAuth provider"""
    providers = {
        "google": {
            "url": "https://accounts.google.com/o/oauth2/v2/auth",
            "scope": "openid email profile",
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        },
        "microsoft": {
            "url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "scope": "openid email profile",
            "client_id": os.getenv("MICROSOFT_CLIENT_ID"),
        }
    }
    if provider not in providers:
        raise HTTPException(400, "Unsupported provider")

    p = providers[provider]
    state = jwt.encode({"tenant_slug": tenant_slug, "provider": provider}, JWT_SECRET, algorithm=JWT_ALGO)
    redirect_uri = f"{os.getenv('BASE_URL')}/auth/oauth/{provider}/callback"

    url = (f"{p['url']}?client_id={p['client_id']}"
           f"&response_type=code&scope={p['scope']}"
           f"&redirect_uri={redirect_uri}&state={state}")
    return {"redirect_url": url}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
