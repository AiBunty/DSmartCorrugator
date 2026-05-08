"""Quote, party profile, and version/item models."""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Float, ForeignKey, Integer,
    Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PartyProfile(Base, UUIDPrimaryKey, TimestampMixin):
    """Customer/buyer master data (party to whom quotes are addressed)."""
    __tablename__ = "party_profiles"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    person_name: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(300))
    mobile: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(254))
    gstin: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    quotes: Mapped[list["Quote"]] = relationship(back_populates="party")


class Quote(Base, UUIDPrimaryKey, TimestampMixin):
    """Quote header row — one per quote across all versions."""
    __tablename__ = "quotes"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    party_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("party_profiles.id", ondelete="SET NULL")
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Quote number — generated server-side as "{prefix}-{year}-{seq:04}"
    quote_no: Mapped[str] = mapped_column(String(50), nullable=False)

    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="draft"
    )  # draft|sent|accepted|rejected|expired|cancelled

    pipeline_stage: Mapped[str] = mapped_column(
        String(30), nullable=False, default="draft"
    )  # draft|sent|viewed|responded|negotiating|won|lost

    # Current live version foreign key (NULL while first version being built)
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("quote_versions.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

    has_financial_docs: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    party: Mapped["PartyProfile | None"] = relationship(back_populates="quotes")
    versions: Mapped[list["QuoteVersion"]] = relationship(
        "QuoteVersion",
        foreign_keys="[QuoteVersion.quote_id]",
        back_populates="quote",
        cascade="all, delete-orphan",
    )


class QuoteVersion(Base, UUIDPrimaryKey):
    """Immutable snapshot of a quote at a point in time."""
    __tablename__ = "quote_versions"

    quote_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Party snapshot at save time
    party_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Company profile snapshot
    company_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Paper prices snapshot — {bf_value: {shade_code: price}} keyed at save time
    paper_prices_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Flute factor snapshot at save time
    flute_factor_a: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False, default=1.55)
    flute_factor_b: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False, default=1.35)
    flute_factor_c: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False, default=1.45)
    flute_factor_e: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False, default=1.25)
    flute_factor_f: Mapped[float] = mapped_column(Numeric(5, 3), nullable=False, default=1.20)

    # Quote-level financials
    gst_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=5)
    transport_charge: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    subtotal_with_transport: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    gst_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    round_off: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    # Terms (snapshot at save time)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    delivery_terms: Mapped[str | None] = mapped_column(Text)
    other_terms: Mapped[str | None] = mapped_column(Text)
    validity_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    # Optional notes
    internal_notes: Mapped[str | None] = mapped_column(Text)

    # Version lifecycle flags
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    quote: Mapped["Quote"] = relationship(
        "Quote", foreign_keys=[quote_id], back_populates="versions"
    )
    items: Mapped[list["QuoteItem"]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )


class QuoteItem(Base, UUIDPrimaryKey):
    """Individual box item within a quote version."""
    __tablename__ = "quote_items"

    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("quote_versions.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )

    # Item ordering / grouping
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    group_id: Mapped[str | None] = mapped_column(String(50))
    selected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Box identification
    box_name: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    cost_basis: Mapped[str] = mapped_column(String(10), nullable=False, default="rsc")  # rsc|sheet

    # Dimensions (inner/OD as entered, always in mm)
    length_mm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    width_mm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    height_mm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    dimension_type: Mapped[str] = mapped_column(String(5), nullable=False, default="inner")  # inner|od
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1000)

    # Optional box outer dims for BCT (V2)
    box_length: Mapped[float | None] = mapped_column(Numeric(10, 2))
    box_width: Mapped[float | None] = mapped_column(Numeric(10, 2))
    box_height: Mapped[float | None] = mapped_column(Numeric(10, 2))
    bct_basis: Mapped[str | None] = mapped_column(String(10))  # 'box'|null

    # Board spec
    ply: Mapped[int] = mapped_column(Integer, nullable=False)
    combination: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. "BCB"

    # Sheet sizes (computed)
    sheet_length_mm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    sheet_width_mm: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Weight
    sheet_weight_kg: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)

    # Strength metrics
    burst_factor: Mapped[float | None] = mapped_column(Numeric(8, 3))
    ect_value: Mapped[float | None] = mapped_column(Numeric(8, 3))
    bct_value: Mapped[float | None] = mapped_column(Numeric(10, 3))
    board_thickness_mm: Mapped[float | None] = mapped_column(Numeric(6, 2))

    # Costs
    paper_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    printing_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    lamination_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    die_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    punching_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    varnish_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    conversion_cost: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    markup_pct: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=15)
    final_cost_per_box: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)

    # Negotiation
    negotiation_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="none")
    original_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False, default=0)
    negotiated_price: Mapped[float | None] = mapped_column(Numeric(12, 4))
    negotiation_reason: Mapped[str | None] = mapped_column(Text)

    # Full layer spec snapshot (JSONB for auditability)
    layer_specs: Mapped[list | None] = mapped_column(JSONB)
    # Cost breakdown snapshot
    cost_breakdown: Mapped[dict | None] = mapped_column(JSONB)

    version: Mapped["QuoteVersion"] = relationship(back_populates="items")
