"""Tenant settings models: business defaults, quote terms, email, company, templates, and rate memory."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class BusinessDefault(Base, UUIDPrimaryKey, TimestampMixin):
    """Single-row tenant business defaults used by cost formulas."""
    __tablename__ = "business_defaults"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    default_markup_pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=15)
    default_conversion_cost_per_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=15)
    default_gst_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=5)
    default_currency_code: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    default_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)
    default_validity_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    quote_number_prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="QT")
    quote_number_next: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class UserQuoteTerm(Base, UUIDPrimaryKey, TimestampMixin):
    """Default payment/delivery terms shown in new quotes."""
    __tablename__ = "user_quote_terms"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    payment_terms: Mapped[str | None] = mapped_column(Text)
    delivery_terms: Mapped[str | None] = mapped_column(Text)
    other_terms: Mapped[str | None] = mapped_column(Text)


class UserEmailSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """SMTP configuration for quote email delivery (password AES-256-GCM encrypted)."""
    __tablename__ = "user_email_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    smtp_host: Mapped[str | None] = mapped_column(String(300))
    smtp_port: Mapped[int | None] = mapped_column(Integer)
    smtp_username: Mapped[str | None] = mapped_column(String(300))
    smtp_password_encrypted: Mapped[str | None] = mapped_column(Text)  # AES-256-GCM ciphertext
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    from_name: Mapped[str | None] = mapped_column(String(200))
    from_email: Mapped[str | None] = mapped_column(String(254))
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CompanyProfile(Base, UUIDPrimaryKey, TimestampMixin):
    """Tenant's own company data printed on quotes."""
    __tablename__ = "company_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    company_name: Mapped[str | None] = mapped_column(String(300))
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(254))
    website: Mapped[str | None] = mapped_column(String(500))
    gstin: Mapped[str | None] = mapped_column(String(20))
    logo_s3_key: Mapped[str | None] = mapped_column(String(500))
    bank_details: Mapped[dict | None] = mapped_column(JSONB)


class AiProviderSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """Tenant-scoped BYOK configuration for AI drafting."""
    __tablename__ = "ai_provider_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    provider_name: Mapped[str] = mapped_column(String(50), nullable=False, default="openai")
    api_key_encrypted: Mapped[str | None] = mapped_column(Text)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4.1-mini")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class TenantSignatureSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """Default and overrideable signature content for quote sends."""
    __tablename__ = "tenant_signature_settings"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    email_signature_html: Mapped[str | None] = mapped_column(Text)
    whatsapp_signature_text: Mapped[str | None] = mapped_column(Text)
    email_signature_label: Mapped[str | None] = mapped_column(String(120))
    whatsapp_signature_label: Mapped[str | None] = mapped_column(String(120))


class MessageTemplate(Base, UUIDPrimaryKey, TimestampMixin):
    """Tenant-owned email and WhatsApp templates, including AI-generated drafts."""
    __tablename__ = "message_templates"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", "channel", name="uq_message_templates_tenant_name_channel"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # email|whatsapp
    subject: Mapped[str | None] = mapped_column(String(500))
    body_html: Mapped[str | None] = mapped_column(Text)
    body_text: Mapped[str | None] = mapped_column(Text)
    variables: Mapped[list | None] = mapped_column(JSONB)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source_preset_key: Mapped[str | None] = mapped_column(String(100))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


class AppSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """Platform-wide key-value settings (managed by platform admin)."""
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)


class BulkUploadJob(Base, UUIDPrimaryKey):
    """Tracks bulk-upload jobs (paper prices, etc.)."""
    __tablename__ = "bulk_upload_jobs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    upload_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'paper_bf_prices' etc.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="processing")
    total_rows: Mapped[int | None] = mapped_column(Integer)
    success_rows: Mapped[int | None] = mapped_column(Integer)
    error_rows: Mapped[int | None] = mapped_column(Integer)
    error_details: Mapped[dict | None] = mapped_column(JSONB)
    s3_key: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
