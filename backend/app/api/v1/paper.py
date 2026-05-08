"""Paper pricing admin API: BF prices, shade premiums, pricing rules, flute settings, rate memory."""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import SessionUser, require_role
from app.database import get_db
from app.models.paper import FluteSetting, PaperBfPrice, PaperPricingRule, RateMemory, ShadePremium

router = APIRouter(prefix="/paper", tags=["paper"])


# ── BF Prices ─────────────────────────────────────────────────────────────────

class BfPriceUpsert(BaseModel):
    bf_value: int
    base_price: float
    is_active: bool = True


@router.get("/bf-prices")
async def list_bf_prices(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(PaperBfPrice)
            .where(PaperBfPrice.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(PaperBfPrice.bf_value)
        )
    ).all()
    return [{"id": str(r.id), "bf_value": r.bf_value, "base_price": float(r.base_price), "is_active": r.is_active} for r in rows]


@router.get("/prices")
async def list_bf_prices_legacy(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible alias for older frontend bundles."""
    rows = (
        await db.scalars(
            select(PaperBfPrice)
            .where(PaperBfPrice.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(PaperBfPrice.bf_value)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "bf": r.bf_value,
            "price_per_kg": float(r.base_price),
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.put("/bf-prices/{bf_value}")
async def upsert_bf_price(
    bf_value: int,
    body: BfPriceUpsert,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    existing = await db.scalar(
        select(PaperBfPrice)
        .where(PaperBfPrice.tenant_id == tid)
        .where(PaperBfPrice.bf_value == bf_value)
    )
    if existing:
        existing.base_price = body.base_price
        existing.is_active = body.is_active
        existing.updated_by = uuid.UUID(current_user.user_id)
    else:
        db.add(PaperBfPrice(
            tenant_id=tid,
            bf_value=bf_value,
            base_price=body.base_price,
            is_active=body.is_active,
            updated_by=uuid.UUID(current_user.user_id),
        ))
    await db.commit()
    return {"message": "Saved"}


# ── Shade Premiums ─────────────────────────────────────────────────────────────

class ShadePremiumUpdate(BaseModel):
    premium: float


@router.get("/shade-premiums")
async def list_shade_premiums(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(ShadePremium)
            .where(ShadePremium.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(ShadePremium.shade_code)
        )
    ).all()
    return [
        {"id": str(r.id), "shade_code": r.shade_code, "shade_label": r.shade_label, "premium": float(r.premium)}
        for r in rows
    ]


@router.get("/shades")
async def list_shade_premiums_legacy(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible alias for older frontend bundles."""
    rows = (
        await db.scalars(
            select(ShadePremium)
            .where(ShadePremium.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(ShadePremium.shade_code)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "shade": r.shade_code,
            "premium_per_kg": float(r.premium),
            "shade_label": r.shade_label,
        }
        for r in rows
    ]


@router.patch("/shade-premiums/{shade_code}")
async def update_shade_premium(
    shade_code: str,
    body: ShadePremiumUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(
        select(ShadePremium)
        .where(ShadePremium.tenant_id == tid)
        .where(ShadePremium.shade_code == shade_code.upper())
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Shade not found")
    row.premium = body.premium
    await db.commit()
    return {"message": "Saved"}


# ── Pricing Rules ─────────────────────────────────────────────────────────────

@router.get("/pricing-rules")
async def list_pricing_rules(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(PaperPricingRule)
            .where(PaperPricingRule.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(PaperPricingRule.rule_order)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "rule_order": r.rule_order,
            "low_gsm_limit": r.low_gsm_limit,
            "high_gsm_limit": r.high_gsm_limit,
            "low_gsm_adjustment": float(r.low_gsm_adjustment),
            "high_gsm_adjustment": float(r.high_gsm_adjustment),
            "market_adjustment": float(r.market_adjustment),
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.get("/rules")
async def list_pricing_rules_legacy(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible alias for older frontend bundles."""
    rows = (
        await db.scalars(
            select(PaperPricingRule)
            .where(PaperPricingRule.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(PaperPricingRule.rule_order)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "rule_order": r.rule_order,
            "low_gsm_limit": r.low_gsm_limit,
            "high_gsm_limit": r.high_gsm_limit,
            "low_gsm_adjustment": float(r.low_gsm_adjustment),
            "high_gsm_adjustment": float(r.high_gsm_adjustment),
            "market_adjustment": float(r.market_adjustment),
            "is_active": r.is_active,
        }
        for r in rows
    ]


# ── Flute Settings ─────────────────────────────────────────────────────────────

class FluteSettingUpdate(BaseModel):
    fluting_factor: float
    flute_height_mm: float


@router.get("/flute-settings")
async def list_flute_settings(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.scalars(
            select(FluteSetting)
            .where(FluteSetting.tenant_id == uuid.UUID(current_user.tenant_id))
            .order_by(FluteSetting.flute_type)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "flute_type": r.flute_type,
            "fluting_factor": float(r.fluting_factor),
            "flute_height_mm": float(r.flute_height_mm),
            "is_active": r.is_active,
        }
        for r in rows
    ]


@router.patch("/flute-settings/{flute_type}")
async def update_flute_setting(
    flute_type: str,
    body: FluteSettingUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(
        select(FluteSetting)
        .where(FluteSetting.tenant_id == tid)
        .where(FluteSetting.flute_type == flute_type.upper())
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Flute type not found")
    row.fluting_factor = body.fluting_factor
    row.flute_height_mm = body.flute_height_mm
    await db.commit()
    return {"message": "Saved"}


# ── Rate Memory (G18) ─────────────────────────────────────────────────────────

class RateMemoryUpsert(BaseModel):
    bf_value: int
    shade_code: str
    manual_rate: float


@router.get("/rate-memory")
async def list_rate_memory(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """Return all remembered manual rates for the tenant."""
    tid = uuid.UUID(current_user.tenant_id)
    rows = (
        await db.scalars(
            select(RateMemory)
            .where(RateMemory.tenant_id == tid)
            .order_by(RateMemory.bf_value, RateMemory.shade_code)
        )
    ).all()
    return [
        {
            "memory_key": r.memory_key,
            "bf_value": r.bf_value,
            "shade_code": r.shade_code,
            "manual_rate": float(r.manual_rate),
            "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]


@router.post("/rate-memory")
async def upsert_rate_memory(
    body: RateMemoryUpsert,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    """Remember or update a manual rate override for a BF+shade combination."""
    tid = uuid.UUID(current_user.tenant_id)
    key = f"{body.bf_value}|{body.shade_code.upper()}"

    existing = await db.scalar(
        select(RateMemory)
        .where(RateMemory.tenant_id == tid)
        .where(RateMemory.memory_key == key)
    )
    if existing:
        existing.manual_rate = body.manual_rate
        existing.last_updated_by = uuid.UUID(current_user.user_id)
    else:
        db.add(RateMemory(
            tenant_id=tid,
            memory_key=key,
            bf_value=body.bf_value,
            shade_code=body.shade_code.upper(),
            manual_rate=body.manual_rate,
            last_updated_by=uuid.UUID(current_user.user_id),
        ))
    await db.commit()
    return {"memory_key": key, "manual_rate": float(body.manual_rate)}

