"""Initial schema: all tables, indexes, RLS policies, pg_trgm extension.

Revision ID: 0001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that should be tenant-isolated with RLS
TENANT_SCOPED_TABLES = [
    "paper_bf_prices",
    "shade_premiums",
    "paper_pricing_rules",
    "flute_settings",
    "business_defaults",
    "user_quote_terms",
    "user_email_settings",
    "company_profiles",
    "rate_memories",
    "party_profiles",
    "quotes",
    "quote_versions",
    "quote_items",
    "audit_logs",
    "bulk_upload_jobs",
    "tenant_memberships",
    "invitations",
]


def upgrade() -> None:
    # ── Extensions ────────────────────────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── tenants ───────────────────────────────────────────────────────────────
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("plan", sa.String(30), nullable=False, server_default="starter"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_globally_suspended", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── tenant_memberships ────────────────────────────────────────────────────
    op.create_table(
        "tenant_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="salesperson"),
        sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("preferred_locale", sa.String(10), nullable=True),
        sa.Column("joined_at", sa.TIMESTAMP(timezone=True), nullable=True, server_default=sa.text("NOW()")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "user_id", name="uq_tenant_user"),
    )
    op.create_index("ix_tenant_memberships_tenant_id", "tenant_memberships", ["tenant_id"])
    op.create_index("ix_tenant_memberships_user_id", "tenant_memberships", ["user_id"])

    # ── invitations ───────────────────────────────────────────────────────────
    op.create_table(
        "invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_invitations_tenant_id", "invitations", ["tenant_id"])
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"])

    # ── paper_bf_prices ───────────────────────────────────────────────────────
    op.create_table(
        "paper_bf_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bf_value", sa.Integer(), nullable=False),
        sa.Column("base_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "bf_value", name="uq_paper_bf_tenant"),
    )
    op.create_index("ix_paper_bf_prices_tenant_id", "paper_bf_prices", ["tenant_id"])

    # ── shade_premiums ────────────────────────────────────────────────────────
    op.create_table(
        "shade_premiums",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("shade_code", sa.String(4), nullable=False),
        sa.Column("shade_label", sa.String(50), nullable=True),
        sa.Column("premium", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "shade_code", name="uq_shade_tenant"),
    )

    # ── paper_pricing_rules ───────────────────────────────────────────────────
    op.create_table(
        "paper_pricing_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rule_order", sa.Integer(), nullable=False),
        sa.Column("low_gsm_limit", sa.Integer(), nullable=True),
        sa.Column("high_gsm_limit", sa.Integer(), nullable=True),
        sa.Column("low_gsm_adjustment", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("high_gsm_adjustment", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("market_adjustment", sa.Numeric(10, 4), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_paper_pricing_rules_tenant_id", "paper_pricing_rules", ["tenant_id"])

    # ── flute_settings ────────────────────────────────────────────────────────
    op.create_table(
        "flute_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("flute_type", sa.String(2), nullable=False),
        sa.Column("fluting_factor", sa.Numeric(6, 4), nullable=False),
        sa.Column("flute_height_mm", sa.Numeric(6, 2), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "flute_type", name="uq_flute_tenant"),
    )

    # ── business_defaults ─────────────────────────────────────────────────────
    op.create_table(
        "business_defaults",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("default_markup_pct", sa.Numeric(6, 2), nullable=False, server_default="15"),
        sa.Column("default_conversion_cost_per_kg", sa.Numeric(10, 4), nullable=False, server_default="15"),
        sa.Column("default_gst_pct", sa.Numeric(6, 2), nullable=False, server_default="5"),
        sa.Column("default_currency_code", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("default_quantity", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("default_validity_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("quote_number_prefix", sa.String(20), nullable=False, server_default="QT"),
        sa.Column("quote_number_next", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── user_quote_terms ──────────────────────────────────────────────────────
    op.create_table(
        "user_quote_terms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column("delivery_terms", sa.Text(), nullable=True),
        sa.Column("other_terms", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── user_email_settings ───────────────────────────────────────────────────
    op.create_table(
        "user_email_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("smtp_host", sa.String(255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True, server_default="587"),
        sa.Column("smtp_username", sa.String(255), nullable=True),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
        sa.Column("use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("from_name", sa.String(100), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── company_profiles ──────────────────────────────────────────────────────
    op.create_table(
        "company_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("website", sa.String(255), nullable=True),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("logo_s3_key", sa.String(500), nullable=True),
        sa.Column("bank_details", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── rate_memories ─────────────────────────────────────────────────────────
    op.create_table(
        "rate_memories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("combination", sa.String(20), nullable=False),
        sa.Column("gsm", sa.Integer(), nullable=False),
        sa.Column("bf_value", sa.Integer(), nullable=True),
        sa.Column("shade_code", sa.String(4), nullable=True),
        sa.Column("resolved_rate", sa.Numeric(12, 4), nullable=False),
        sa.Column("last_used_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_rate_memories_tenant_id", "rate_memories", ["tenant_id"])

    # ── app_settings ──────────────────────────────────────────────────────────
    op.create_table(
        "app_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── bulk_upload_jobs ──────────────────────────────────────────────────────
    op.create_table(
        "bulk_upload_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_type", sa.String(20), nullable=False),
        sa.Column("s3_key", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("processed_rows", sa.Integer(), nullable=True),
        sa.Column("error_count", sa.Integer(), nullable=True),
        sa.Column("error_details", postgresql.JSONB(), nullable=True),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )

    # ── party_profiles ────────────────────────────────────────────────────────
    op.create_table(
        "party_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_name", sa.String(100), nullable=False),
        sa.Column("company_name", sa.String(200), nullable=True),
        sa.Column("mobile", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("gstin", sa.String(15), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_party_profiles_tenant_id", "party_profiles", ["tenant_id"])
    op.execute("CREATE INDEX ix_party_profiles_search ON party_profiles USING gin((person_name || ' ' || COALESCE(company_name,'')) gin_trgm_ops)")

    # ── quotes ────────────────────────────────────────────────────────────────
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("party_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("party_profiles.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quote_no", sa.String(50), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("pipeline_stage", sa.String(30), nullable=True, server_default="draft"),
        sa.Column("current_version_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("has_financial_docs", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("tenant_id", "quote_no", name="uq_quote_no_tenant"),
    )
    op.create_index("ix_quotes_tenant_id", "quotes", ["tenant_id"])
    op.create_index("ix_quotes_party_id", "quotes", ["party_id"])
    op.create_index("ix_quotes_status", "quotes", ["status"])

    # ── quote_versions ────────────────────────────────────────────────────────
    op.create_table(
        "quote_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("party_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("company_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("paper_prices_snapshot", postgresql.JSONB(), nullable=True),
        sa.Column("flute_factor_a", sa.Numeric(6, 4), nullable=True),
        sa.Column("flute_factor_b", sa.Numeric(6, 4), nullable=True),
        sa.Column("flute_factor_c", sa.Numeric(6, 4), nullable=True),
        sa.Column("flute_factor_e", sa.Numeric(6, 4), nullable=True),
        sa.Column("flute_factor_f", sa.Numeric(6, 4), nullable=True),
        sa.Column("gst_pct", sa.Numeric(6, 2), nullable=False, server_default="5"),
        sa.Column("transport_charge", sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("subtotal", sa.Numeric(14, 4), nullable=True),
        sa.Column("subtotal_with_transport", sa.Numeric(14, 4), nullable=True),
        sa.Column("gst_amount", sa.Numeric(14, 4), nullable=True),
        sa.Column("round_off", sa.Numeric(10, 4), nullable=True),
        sa.Column("grand_total", sa.Numeric(14, 4), nullable=True),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column("delivery_terms", sa.Text(), nullable=True),
        sa.Column("other_terms", sa.Text(), nullable=True),
        sa.Column("validity_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("internal_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("quote_id", "version_number", name="uq_version_per_quote"),
    )
    op.create_index("ix_quote_versions_quote_id", "quote_versions", ["quote_id"])

    # ── quote_items ───────────────────────────────────────────────────────────
    op.create_table(
        "quote_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("quote_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("group_id", sa.String(50), nullable=True),
        sa.Column("selected", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("box_name", sa.String(200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cost_basis", sa.String(10), nullable=False, server_default="rsc"),
        sa.Column("length_mm", sa.Numeric(10, 2), nullable=False),
        sa.Column("width_mm", sa.Numeric(10, 2), nullable=False),
        sa.Column("height_mm", sa.Numeric(10, 2), nullable=False),
        sa.Column("dimension_type", sa.String(10), nullable=False, server_default="inner"),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("ply", sa.Integer(), nullable=False),
        sa.Column("combination", sa.String(30), nullable=False),
        sa.Column("box_length", sa.Numeric(10, 2), nullable=True),
        sa.Column("box_width", sa.Numeric(10, 2), nullable=True),
        sa.Column("box_height", sa.Numeric(10, 2), nullable=True),
        sa.Column("bct_basis", sa.String(20), nullable=True),
        sa.Column("sheet_length_mm", sa.Numeric(10, 2), nullable=True),
        sa.Column("sheet_width_mm", sa.Numeric(10, 2), nullable=True),
        sa.Column("sheet_weight_kg", sa.Numeric(12, 6), nullable=True),
        sa.Column("burst_factor", sa.Numeric(10, 4), nullable=True),
        sa.Column("ect_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("bct_value", sa.Numeric(10, 2), nullable=True),
        sa.Column("board_thickness_mm", sa.Numeric(8, 3), nullable=True),
        sa.Column("paper_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("printing_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("lamination_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("die_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("punching_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("varnish_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("conversion_cost", sa.Numeric(14, 6), nullable=True),
        sa.Column("markup_pct", sa.Numeric(6, 2), nullable=False, server_default="15"),
        sa.Column("final_cost_per_box", sa.Numeric(14, 6), nullable=True),
        sa.Column("negotiation_mode", sa.String(20), nullable=False, server_default="none"),
        sa.Column("original_price", sa.Numeric(14, 6), nullable=True),
        sa.Column("negotiated_price", sa.Numeric(14, 6), nullable=True),
        sa.Column("negotiation_reason", sa.Text(), nullable=True),
        sa.Column("layer_specs", postgresql.JSONB(), nullable=True),
        sa.Column("cost_breakdown", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_quote_items_version_id", "quote_items", ["version_id"])

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_email", sa.String(255), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(50), nullable=True),
        sa.Column("diff", postgresql.JSONB(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_resource_type_id", "audit_logs", ["resource_type", "resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── Add deferred FK: quotes.current_version_id → quote_versions.id ───────
    op.create_foreign_key(
        "fk_quotes_current_version",
        "quotes", "quote_versions",
        ["current_version_id"], ["id"],
        ondelete="SET NULL",
        use_alter=True,
        deferrable=True,
        initially="DEFERRED",
    )

    # ── Row Level Security ────────────────────────────────────────────────────
    for table in TENANT_SCOPED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
                USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
            """
        )

    # Allow service role to bypass RLS (used by Alembic and background jobs)
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
                CREATE ROLE service_role BYPASSRLS;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    tables = [
        "audit_logs", "quote_items", "quote_versions",
        "quotes", "party_profiles",
        "bulk_upload_jobs", "app_settings", "rate_memories",
        "company_profiles", "user_email_settings", "user_quote_terms",
        "business_defaults", "flute_settings", "paper_pricing_rules",
        "shade_premiums", "paper_bf_prices",
        "invitations", "tenant_memberships", "users", "tenants",
    ]
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")

    op.execute('DROP EXTENSION IF EXISTS "uuid-ossp"')
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
