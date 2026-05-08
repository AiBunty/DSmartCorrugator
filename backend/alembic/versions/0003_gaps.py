"""Gap audit implementation: QuoteVersion flags, RateMemory table.

Revision ID: 0003
Revises: 0002
Create Date: 2026-01-01 00:00:00.000000
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # G07: Add is_archived and is_locked to quote_versions
    op.add_column(
        "quote_versions",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "quote_versions",
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"),
    )

    # G18: Create rate_memory table
    op.create_table(
        "rate_memory",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("memory_key", sa.String(50), nullable=False),
        sa.Column("bf_value", sa.Integer(), nullable=False),
        sa.Column("shade_code", sa.String(20), nullable=False),
        sa.Column("manual_rate", sa.Numeric(10, 2), nullable=False),
        sa.Column(
            "last_updated_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("tenant_id", "memory_key", name="uq_rate_memory_tenant_key"),
    )


def downgrade() -> None:
    op.drop_table("rate_memory")
    op.drop_column("quote_versions", "is_locked")
    op.drop_column("quote_versions", "is_archived")
