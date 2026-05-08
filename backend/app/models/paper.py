"""Paper pricing master data models."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PaperBfPrice(Base, UUIDPrimaryKey, TimestampMixin):
    """BF-bucket base prices per tenant. F08 consults this table."""
    __tablename__ = "paper_bf_prices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "bf_value", name="uq_paper_bf_prices_tenant_bf"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    bf_value: Mapped[int] = mapped_column(Integer, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class ShadePremium(Base, UUIDPrimaryKey, TimestampMixin):
    """Per-shade surcharge added on top of base BF price. F08."""
    __tablename__ = "shade_premiums"
    __table_args__ = (
        UniqueConstraint("tenant_id", "shade_code", name="uq_shade_premiums_tenant_shade"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    shade_code: Mapped[str] = mapped_column(String(20), nullable=False)  # W, K, HW, HK, MG, BF, CC, SC, GL, ST, CR
    shade_label: Mapped[str] = mapped_column(String(50), nullable=False)
    premium: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)


class PaperPricingRule(Base, UUIDPrimaryKey, TimestampMixin):
    """GSM-range and market-adjustment rules for paper pricing. F08."""
    __tablename__ = "paper_pricing_rules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "rule_order", name="uq_paper_pricing_rules_order"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    rule_order: Mapped[int] = mapped_column(Integer, nullable=False)
    low_gsm_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    high_gsm_limit: Mapped[int] = mapped_column(Integer, nullable=False)
    low_gsm_adjustment: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    high_gsm_adjustment: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    market_adjustment: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class FluteSetting(Base, UUIDPrimaryKey, TimestampMixin):
    """Per-flute-type customizable constants (factors, heights). F06/F11/F12."""
    __tablename__ = "flute_settings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "flute_type", name="uq_flute_settings_tenant_flute"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    flute_type: Mapped[str] = mapped_column(String(5), nullable=False)  # A|B|C|E|F
    fluting_factor: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False)
    flute_height_mm: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class RateMemory(Base, UUIDPrimaryKey, TimestampMixin):
    """Per-tenant memory of the last manually overridden paper rate for a BF+shade key."""
    __tablename__ = "rate_memory"
    __table_args__ = (
        UniqueConstraint("tenant_id", "memory_key", name="uq_rate_memory_tenant_key"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    memory_key: Mapped[str] = mapped_column(String(50), nullable=False)  # "{bf}|{shade}"
    bf_value: Mapped[int] = mapped_column(Integer, nullable=False)
    shade_code: Mapped[str] = mapped_column(String(20), nullable=False)
    manual_rate: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    last_updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
