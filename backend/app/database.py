"""Async SQLAlchemy engine and session factory."""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# NullPool is recommended for async PgBouncer-compatible deployments.
# Switch to AsyncAdaptedQueuePool for pure asyncpg without PgBouncer.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    poolclass=NullPool,
    # Ensure app.tenant_id SET LOCAL works in transaction scope
    execution_options={"isolation_level": "READ COMMITTED"},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
