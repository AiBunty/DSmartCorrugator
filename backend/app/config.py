"""BoxCostPro Backend — Application Configuration"""
from functools import lru_cache
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://boxcostpro:password@localhost:5432/boxcostpro"

    # ── Redis ────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Object Storage (S3-compatible) ───────────────────────
    S3_ENDPOINT_URL: str = ""           # empty = use real AWS S3
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = "boxcostpro"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_BASE_URL: str = ""        # CDN prefix for public URLs

    # ── Security ─────────────────────────────────────────────
    # 32-byte hex string — used for AES-256-GCM encryption of SMTP/OAuth tokens
    ENCRYPTION_KEY: str = ""
    # Cookie signing
    SESSION_SECRET: str = "dev-secret-CHANGE-IN-PRODUCTION"
    SESSION_TTL_DAYS: int = 7
    SESSION_COOKIE_NAME: str = "bcp_session"

    # Platform admin key for /api/v1/admin/* endpoints
    ADMIN_API_KEY: str = "dev-admin-key-CHANGE-IN-PRODUCTION"

    # ── App ───────────────────────────────────────────────────
    APP_ENV: str = "development"
    APP_VERSION: str = "1.0.0"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    # ── Email (SendGrid fallback for invitations) ─────────────
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@boxcostpro.com"
    SENDGRID_FROM_NAME: str = "BoxCostPro"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def session_ttl_seconds(self) -> int:
        return self.SESSION_TTL_DAYS * 86400

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
