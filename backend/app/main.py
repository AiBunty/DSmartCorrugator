"""FastAPI application entry point."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, update

from app.config import get_settings
from app.database import AsyncSessionLocal, engine
from app.middleware.session_tenant import SessionTenantMiddleware
from app.redis_client import close_redis, get_redis

# Import all routers
from app.api.v1.auth import router as auth_router
from app.api.v1.paper import router as paper_router
from app.api.v1.quotes import router as quotes_router
from app.api.v1.settings import router as settings_router
from app.api.v1.team import router as team_router

SETTINGS = get_settings()
logger = logging.getLogger(__name__)
_scheduler = AsyncIOScheduler()


async def _expire_stale_quotes() -> None:
    """Daily job: mark draft/sent quotes as expired when their validity window has passed."""
    from app.models.quote import Quote, QuoteVersion  # local import to avoid startup circular issues

    now = datetime.now(timezone.utc)
    try:
        async with AsyncSessionLocal() as db:
            # Load quotes that are draft or sent and have a current_version_id
            rows = (
                await db.scalars(
                    select(Quote)
                    .where(Quote.status.in_(["draft", "sent"]))
                    .where(Quote.deleted_at.is_(None))
                    .where(Quote.current_version_id.is_not(None))
                )
            ).all()

            expired_ids = []
            for quote in rows:
                version = await db.scalar(
                    select(QuoteVersion).where(QuoteVersion.id == quote.current_version_id)
                )
                if version and version.validity_days:
                    expires_at = version.created_at + timedelta(days=int(version.validity_days))
                    if now > expires_at:
                        expired_ids.append(quote.id)

            if expired_ids:
                for qid in expired_ids:
                    q = await db.scalar(select(Quote).where(Quote.id == qid))
                    if q:
                        q.status = "expired"
                        q.pipeline_stage = "expired"
                await db.commit()
                logger.info("Expired %d quotes.", len(expired_ids))
    except Exception as exc:  # noqa: BLE001
        logger.error("Error in _expire_stale_quotes: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm Redis connection + start scheduler
    await get_redis()
    _scheduler.add_job(_expire_stale_quotes, "cron", hour=0, minute=5, id="expire_quotes")
    _scheduler.start()
    yield
    # Shutdown
    _scheduler.shutdown(wait=False)
    await close_redis()


app = FastAPI(
    title="BoxCostPro API",
    version="1.0.0",
    docs_url="/api/docs" if not SETTINGS.is_production else None,
    redoc_url="/api/redoc" if not SETTINGS.is_production else None,
    openapi_url="/api/openapi.json" if not SETTINGS.is_production else None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=SETTINGS.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-User-Role", "X-Tenant-Id", "X-Plan"],
)

# Session + Tenant middleware (must come after CORS)
app.add_middleware(SessionTenantMiddleware)

# Register routers
API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(paper_router, prefix=API_PREFIX)
app.include_router(quotes_router, prefix=API_PREFIX)
app.include_router(settings_router, prefix=API_PREFIX)
app.include_router(team_router, prefix=API_PREFIX)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
