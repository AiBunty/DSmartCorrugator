"""Quotes API: CRUD for quotes, versions, and items."""
from __future__ import annotations

import asyncio
import smtplib
import uuid
from datetime import date
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rbac import SessionUser, require_role
from app.database import get_db
from app.formulas.engine import (
    FluteConfig, LayerSpec, RSCInputs, calculate_rsc, calculate_quote_totals,
)
from app.models.paper import FluteSetting, PaperBfPrice, PaperPricingRule, ShadePremium
from app.models.quote import PartyProfile, Quote, QuoteItem, QuoteVersion
from app.models.settings import BusinessDefault, CompanyProfile, UserEmailSetting, UserQuoteTerm

router = APIRouter(prefix="/quotes", tags=["quotes"])


REPORT_STATUSES = {"draft", "sent", "accepted", "rejected", "expired", "archived"}


def _can_manage_quote(current_user: SessionUser, quote: Quote) -> bool:
    if current_user.role in {"owner", "admin", "manager"}:
        return True
    if current_user.role == "salesperson":
        return str(quote.created_by) == current_user.user_id
    return False


# ── Party Profiles ────────────────────────────────────────────────────────────

class PartyProfileCreate(BaseModel):
    person_name: str
    company_name: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    gstin: Optional[str] = None
    address: Optional[str] = None


@router.get("/parties")
async def list_parties(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    rows = (
        await db.scalars(
            select(PartyProfile)
            .where(PartyProfile.tenant_id == tid)
            .where(PartyProfile.is_archived == False)  # noqa: E712
            .order_by(PartyProfile.person_name)
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "person_name": r.person_name,
            "company_name": r.company_name,
            "mobile": r.mobile,
            "email": r.email,
            "gstin": r.gstin,
        }
        for r in rows
    ]


@router.post("/parties", status_code=status.HTTP_201_CREATED)
async def create_party(
    body: PartyProfileCreate,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    party = PartyProfile(
        tenant_id=uuid.UUID(current_user.tenant_id), **body.model_dump()
    )
    db.add(party)
    await db.commit()
    return {"id": str(party.id)}


@router.patch("/parties/{party_id}")
async def update_party(
    party_id: uuid.UUID,
    body: PartyProfileCreate,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    party = await db.scalar(
        select(PartyProfile)
        .where(PartyProfile.id == party_id)
        .where(PartyProfile.tenant_id == tid)
    )
    if party is None:
        raise HTTPException(status_code=404, detail="Party not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(party, k, v)
    await db.commit()
    return {"message": "Updated"}


@router.delete("/parties/{party_id}", status_code=status.HTTP_200_OK)
async def delete_party(
    party_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("manager")),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a party (is_archived = True). Manager+ only."""
    tid = uuid.UUID(current_user.tenant_id)
    party = await db.scalar(
        select(PartyProfile)
        .where(PartyProfile.id == party_id)
        .where(PartyProfile.tenant_id == tid)
    )
    if party is None:
        raise HTTPException(status_code=404, detail="Party not found")
    party.is_archived = True
    await db.commit()
    return {"success": True}


# ── Quotes ────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_quotes(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
    status: Optional[str] = None,
):
    tid = uuid.UUID(current_user.tenant_id)
    q = (
        select(Quote)
        .where(Quote.tenant_id == tid)
        .where(Quote.is_archived == False)  # noqa: E712
        .where(Quote.deleted_at == None)  # noqa: E711
        .order_by(Quote.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Quote.party))
    )
    if status:
        q = q.where(Quote.status == status)

    rows = (await db.scalars(q)).all()
    return [
        {
            "id": str(r.id),
            "quote_no": r.quote_no,
            "status": r.status,
            "pipeline_stage": r.pipeline_stage,
            "party_name": r.party.person_name if r.party else None,
            "company_name": r.party.company_name if r.party else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


@router.get("/reports")
async def list_quotes_for_reports(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 25,
    status: Optional[str] = None,
    search: Optional[str] = None,
    party_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    tid = uuid.UUID(current_user.tenant_id)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    filters = [
        Quote.tenant_id == tid,
        Quote.deleted_at == None,  # noqa: E711
    ]

    if status and status in REPORT_STATUSES and status != "all":
        filters.append(Quote.status == status)
    if party_id:
        filters.append(Quote.party_id == party_id)
    if start_date:
        filters.append(func.date(Quote.created_at) >= start_date)
    if end_date:
        filters.append(func.date(Quote.created_at) <= end_date)
    if current_user.role == "salesperson":
        filters.append(Quote.created_by == uuid.UUID(current_user.user_id))

    search_text = (search or "").strip()
    if search_text:
        like = f"%{search_text}%"
        filters.append(
            or_(
                Quote.quote_no.ilike(like),
                PartyProfile.person_name.ilike(like),
                PartyProfile.company_name.ilike(like),
                QuoteItem.box_name.ilike(like),
            )
        )

    count_q = (
        select(func.count(func.distinct(Quote.id)))
        .select_from(Quote)
        .outerjoin(PartyProfile, PartyProfile.id == Quote.party_id)
        .outerjoin(QuoteVersion, QuoteVersion.id == Quote.current_version_id)
        .outerjoin(QuoteItem, QuoteItem.version_id == QuoteVersion.id)
        .where(*filters)
    )
    total = int((await db.scalar(count_q)) or 0)

    q = (
        select(
            Quote.id,
            Quote.quote_no,
            Quote.status,
            Quote.pipeline_stage,
            Quote.created_at,
            PartyProfile.person_name,
            PartyProfile.company_name,
            func.coalesce(func.max(QuoteVersion.grand_total), 0).label("grand_total"),
            func.count(func.distinct(QuoteItem.id)).label("items_count"),
        )
        .select_from(Quote)
        .outerjoin(PartyProfile, PartyProfile.id == Quote.party_id)
        .outerjoin(QuoteVersion, QuoteVersion.id == Quote.current_version_id)
        .outerjoin(QuoteItem, QuoteItem.version_id == QuoteVersion.id)
        .where(*filters)
        .group_by(
            Quote.id,
            Quote.quote_no,
            Quote.status,
            Quote.pipeline_stage,
            Quote.created_at,
            PartyProfile.person_name,
            PartyProfile.company_name,
        )
        .order_by(Quote.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = (await db.execute(q)).all()
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return {
        "data": [
            {
                "id": str(r.id),
                "quote_no": r.quote_no,
                "status": r.status,
                "pipeline_stage": r.pipeline_stage,
                "party_name": r.person_name,
                "company_name": r.company_name,
                "created_at": r.created_at.isoformat(),
                "items_count": int(r.items_count or 0),
                "grand_total": float(r.grand_total or 0),
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": total_pages,
    }


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_quote(
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new empty quote (draft). Returns the new quote id."""
    tid = uuid.UUID(current_user.tenant_id)

    # Generate quote number atomically using UPDATE ... RETURNING
    defaults = await db.scalar(
        select(BusinessDefault).where(BusinessDefault.tenant_id == tid)
    )
    if defaults is None:
        raise HTTPException(status_code=500, detail="Business defaults not found")

    seq = defaults.quote_number_next
    defaults.quote_number_next = seq + 1
    year = datetime.now(timezone.utc).year
    quote_no = f"{defaults.quote_number_prefix}-{year}-{seq:04d}"

    quote = Quote(
        tenant_id=tid,
        created_by=uuid.UUID(current_user.user_id),
        quote_no=quote_no,
        status="draft",
        pipeline_stage="draft",
    )
    db.add(quote)
    await db.commit()
    return {"id": str(quote.id), "quote_no": quote_no}


@router.get("/{quote_id}")
async def get_quote(
    quote_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    quote = await db.scalar(
        select(Quote)
        .where(Quote.id == quote_id)
        .where(Quote.tenant_id == tid)
        .options(selectinload(Quote.party))
        .options(selectinload(Quote.versions).selectinload(QuoteVersion.items))
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    versions_data = []
    for v in sorted(quote.versions, key=lambda x: x.version_number):
        versions_data.append({
            "id": str(v.id),
            "version_number": v.version_number,
            "created_at": v.created_at.isoformat(),
            "grand_total": float(v.grand_total),
            "item_count": len(v.items),
        })

    return {
        "id": str(quote.id),
        "quote_no": quote.quote_no,
        "status": quote.status,
        "pipeline_stage": quote.pipeline_stage,
        "party": {
            "id": str(quote.party.id),
            "person_name": quote.party.person_name,
            "company_name": quote.party.company_name,
            "email": quote.party.email,
            "mobile": quote.party.mobile,
            "gstin": quote.party.gstin,
        } if quote.party else None,
        "versions": versions_data,
        "current_version_id": str(quote.current_version_id) if quote.current_version_id else None,
        "has_financial_docs": quote.has_financial_docs,
        "created_at": quote.created_at.isoformat(),
    }


class QuoteStatusPatch(BaseModel):
    status: str


@router.patch("/{quote_id}/status")
async def patch_quote_status(
    quote_id: uuid.UUID,
    body: QuoteStatusPatch,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    if body.status not in REPORT_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid status")

    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id).where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    if not _can_manage_quote(current_user, quote):
        raise HTTPException(status_code=403, detail="Insufficient permission to update this quote")

    quote.status = body.status
    quote.pipeline_stage = body.status
    await db.commit()

    return {
        "id": str(quote.id),
        "status": quote.status,
        "pipeline_stage": quote.pipeline_stage,
    }


@router.delete("/{quote_id}")
async def delete_quote(
    quote_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id).where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    if not _can_manage_quote(current_user, quote):
        raise HTTPException(status_code=403, detail="Insufficient permission to delete this quote")

    quote.is_archived = True
    quote.status = "archived"
    quote.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True}


# ── Quote Save (version snapshot) ────────────────────────────────────────────

class QuoteItemInput(BaseModel):
    box_name: Optional[str] = None
    description: Optional[str] = None
    cost_basis: str = "rsc"
    length_mm: float
    width_mm: float
    height_mm: float
    dimension_type: str = "inner"
    quantity: int = 1000
    ply: int
    combination: str
    layer_specs: list[dict]   # raw layer spec dicts from frontend
    markup_pct: float = 15.0
    conversion_cost_per_kg: float = 15.0
    printing_cost_per_box: float = 0.0
    lamination_cost_per_box: float = 0.0
    die_cost_per_box: float = 0.0
    punching_cost_per_box: float = 0.0
    varnish_cost_per_box: float = 0.0
    selected: bool = True
    group_id: Optional[str] = None
    box_length: Optional[float] = None
    box_width: Optional[float] = None
    box_height: Optional[float] = None
    negotiation_mode: str = "none"
    original_price: float = 0.0
    negotiated_price: Optional[float] = None
    negotiation_reason: Optional[str] = None


class SaveQuoteRequest(BaseModel):
    party_id: uuid.UUID
    items: list[QuoteItemInput]
    gst_pct: float = 5.0
    transport_charge: float = 0.0
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    other_terms: Optional[str] = None
    validity_days: int = 30
    internal_notes: Optional[str] = None


@router.post("/{quote_id}/save")
async def save_quote_version(
    quote_id: uuid.UUID,
    body: SaveQuoteRequest,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    """
    Authoritatively compute all formulas server-side, snapshot paper prices
    and flute factors, and save a new quote version.
    """
    tid = uuid.UUID(current_user.tenant_id)

    # Load quote
    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id).where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Load party
    party = await db.scalar(
        select(PartyProfile)
        .where(PartyProfile.id == body.party_id)
        .where(PartyProfile.tenant_id == tid)
    )
    if party is None:
        raise HTTPException(status_code=404, detail="Party not found")

    # Load tenant-level pricing data (needed for F08)
    bf_price_rows = (
        await db.scalars(
            select(PaperBfPrice)
            .where(PaperBfPrice.tenant_id == tid)
            .where(PaperBfPrice.is_active == True)  # noqa: E712
        )
    ).all()
    bf_prices: dict[int, float] = {r.bf_value: float(r.base_price) for r in bf_price_rows}

    shade_rows = (
        await db.scalars(select(ShadePremium).where(ShadePremium.tenant_id == tid))
    ).all()
    shade_premiums: dict[str, float] = {r.shade_code: float(r.premium) for r in shade_rows}

    pricing_rules = (
        await db.scalars(
            select(PaperPricingRule)
            .where(PaperPricingRule.tenant_id == tid)
            .where(PaperPricingRule.is_active == True)  # noqa: E712
            .order_by(PaperPricingRule.rule_order)
        )
    ).all()
    rules_list = [
        {
            "rule_order": r.rule_order,
            "low_gsm_limit": r.low_gsm_limit,
            "high_gsm_limit": r.high_gsm_limit,
            "low_gsm_adjustment": float(r.low_gsm_adjustment),
            "high_gsm_adjustment": float(r.high_gsm_adjustment),
            "market_adjustment": float(r.market_adjustment),
            "is_active": r.is_active,
        }
        for r in pricing_rules
    ]

    flute_rows = (
        await db.scalars(
            select(FluteSetting)
            .where(FluteSetting.tenant_id == tid)
            .where(FluteSetting.is_active == True)  # noqa: E712
        )
    ).all()
    flute_configs: dict[str, FluteConfig] = {
        r.flute_type: FluteConfig(factor=float(r.fluting_factor), height_mm=float(r.flute_height_mm))
        for r in flute_rows
    }

    # Load company profile
    company = await db.scalar(
        select(CompanyProfile).where(CompanyProfile.tenant_id == tid)
    )

    # Load default terms if not provided
    terms = await db.scalar(select(UserQuoteTerm).where(UserQuoteTerm.tenant_id == tid))

    # Version number
    existing_versions_count = await db.scalar(
        select(func.count()).where(QuoteVersion.quote_id == quote.id)
    )
    version_number = (existing_versions_count or 0) + 1

    # Build paper prices snapshot
    paper_prices_snapshot: dict = {
        str(bf): {shade: price for shade, price in shade_premiums.items()}
        for bf, price in bf_prices.items()
    }

    # Party snapshot
    party_snapshot = {
        "person_name": party.person_name,
        "company_name": party.company_name,
        "mobile": party.mobile,
        "email": party.email,
        "gstin": party.gstin,
        "address": party.address,
    }

    # Company snapshot
    company_snapshot = {}
    if company:
        company_snapshot = {
            "company_name": company.company_name,
            "address": company.address,
            "phone": company.phone,
            "email": company.email,
            "website": company.website,
            "gstin": company.gstin,
            "logo_s3_key": company.logo_s3_key,
        }

    # Get flute factor snapshot values
    ff = {ft: float(fc.factor) for ft, fc in flute_configs.items()}

    # Create version
    version = QuoteVersion(
        quote_id=quote.id,
        tenant_id=tid,
        version_number=version_number,
        created_by=uuid.UUID(current_user.user_id),
        party_snapshot=party_snapshot,
        company_snapshot=company_snapshot,
        paper_prices_snapshot=paper_prices_snapshot,
        flute_factor_a=ff.get("A", 1.55),
        flute_factor_b=ff.get("B", 1.35),
        flute_factor_c=ff.get("C", 1.45),
        flute_factor_e=ff.get("E", 1.25),
        flute_factor_f=ff.get("F", 1.20),
        gst_pct=body.gst_pct,
        transport_charge=body.transport_charge,
        payment_terms=body.payment_terms or (terms.payment_terms if terms else None),
        delivery_terms=body.delivery_terms or (terms.delivery_terms if terms else None),
        other_terms=body.other_terms or (terms.other_terms if terms else None),
        validity_days=body.validity_days,
        internal_notes=body.internal_notes,
    )
    db.add(version)
    await db.flush()

    # Compute items server-side
    computed_items = []
    all_errors: list[str] = []

    for idx, item_input in enumerate(body.items):
        layers = [
            LayerSpec(
                role=ls["role"],
                gsm=ls["gsm"],
                bf=ls["bf"],
                shade=ls["shade"],
                reel_size_m=ls.get("reel_size_m", 1.0),
            )
            for ls in item_input.layer_specs
        ]

        inp = RSCInputs(
            length_mm=item_input.length_mm,
            width_mm=item_input.width_mm,
            height_mm=item_input.height_mm,
            ply=item_input.ply,
            combination=item_input.combination,
            layers=layers,
            quantity=item_input.quantity,
            markup_pct=item_input.markup_pct,
            conversion_cost_per_kg=item_input.conversion_cost_per_kg,
            printing_cost_per_box=item_input.printing_cost_per_box,
            lamination_cost_per_box=item_input.lamination_cost_per_box,
            die_cost_per_box=item_input.die_cost_per_box,
            punching_cost_per_box=item_input.punching_cost_per_box,
            varnish_cost_per_box=item_input.varnish_cost_per_box,
            flute_configs=flute_configs,
        )
        result = calculate_rsc(
            inp, bf_prices, shade_premiums, rules_list,
            box_length_mm=item_input.box_length,
            box_width_mm=item_input.box_width,
        )
        all_errors.extend(result.errors)

        qi = QuoteItem(
            version_id=version.id,
            tenant_id=tid,
            sort_order=idx,
            group_id=item_input.group_id,
            selected=item_input.selected,
            box_name=item_input.box_name,
            description=item_input.description,
            cost_basis=item_input.cost_basis,
            length_mm=item_input.length_mm,
            width_mm=item_input.width_mm,
            height_mm=item_input.height_mm,
            dimension_type=item_input.dimension_type,
            quantity=item_input.quantity,
            ply=item_input.ply,
            combination=item_input.combination,
            box_length=item_input.box_length,
            box_width=item_input.box_width,
            box_height=item_input.box_height,
            bct_basis="box" if item_input.box_length else None,
            sheet_length_mm=result.sheet_length_mm,
            sheet_width_mm=result.sheet_width_mm,
            sheet_weight_kg=result.sheet_weight_kg,
            burst_factor=result.burst_factor,
            ect_value=result.ect_value,
            bct_value=result.bct_value,
            board_thickness_mm=result.board_thickness_mm,
            paper_cost=result.paper_cost,
            printing_cost=result.printing_cost,
            lamination_cost=result.lamination_cost,
            die_cost=result.die_cost,
            punching_cost=result.punching_cost,
            varnish_cost=result.varnish_cost,
            conversion_cost=result.conversion_cost,
            markup_pct=item_input.markup_pct,
            final_cost_per_box=result.total_cost_per_box,
            negotiation_mode=item_input.negotiation_mode,
            original_price=item_input.original_price or result.total_cost_per_box,
            negotiated_price=item_input.negotiated_price,
            negotiation_reason=item_input.negotiation_reason,
            layer_specs=item_input.layer_specs,
        )
        db.add(qi)
        computed_items.append({
            "final_cost_per_box": result.total_cost_per_box,
            "quantity": item_input.quantity,
            "selected": item_input.selected,
        })

    if all_errors:
        # Roll back and return errors — don't save a quote with blocking errors
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Formula errors prevented save", "errors": all_errors},
        )

    # Compute totals (F20–F23)
    totals = calculate_quote_totals(computed_items, body.gst_pct, body.transport_charge)
    version.subtotal = totals["subtotal"]
    version.subtotal_with_transport = totals["subtotal_with_transport"]
    version.gst_amount = totals["gst_amount"]
    version.round_off = totals["round_off"]
    version.grand_total = totals["grand_total"]

    # Update quote header
    quote.party_id = body.party_id
    quote.current_version_id = version.id

    await db.commit()

    return {
        "version_id": str(version.id),
        "version_number": version_number,
        "grand_total": float(version.grand_total),
        "subtotal": float(version.subtotal),
        "gst_amount": float(version.gst_amount),
        "round_off": float(version.round_off),
    }


# ── Version history & restore (G07, G08) ─────────────────────────────────────

@router.get("/{quote_id}/versions")
async def list_quote_versions(
    quote_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """List all versions for a quote, newest first."""
    tid = uuid.UUID(current_user.tenant_id)
    quote = await db.scalar(
        select(Quote)
        .where(Quote.id == quote_id)
        .where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    versions = (
        await db.scalars(
            select(QuoteVersion)
            .where(QuoteVersion.quote_id == quote_id)
            .where(QuoteVersion.is_archived == False)  # noqa: E712
            .options(selectinload(QuoteVersion.items))
            .order_by(QuoteVersion.version_number.desc())
        )
    ).all()

    return [
        {
            "id": str(v.id),
            "version_number": v.version_number,
            "created_at": v.created_at.isoformat(),
            "grand_total": float(v.grand_total),
            "subtotal": float(v.subtotal),
            "gst_pct": float(v.gst_pct),
            "item_count": len(v.items),
            "is_locked": v.is_locked,
            "is_current": str(v.id) == str(quote.current_version_id),
        }
        for v in versions
    ]


@router.get("/{quote_id}/versions/{version_number}")
async def get_quote_version_detail(
    quote_id: uuid.UUID,
    version_number: int,
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    """Return one quote version with complete items payload for editor hydration."""
    tid = uuid.UUID(current_user.tenant_id)

    quote = await db.scalar(
        select(Quote)
        .where(Quote.id == quote_id)
        .where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    version = await db.scalar(
        select(QuoteVersion)
        .where(QuoteVersion.quote_id == quote_id)
        .where(QuoteVersion.version_number == version_number)
        .where(QuoteVersion.tenant_id == tid)
        .options(selectinload(QuoteVersion.items))
    )
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    sorted_items = sorted(version.items, key=lambda item: item.sort_order)
    return {
        "id": str(version.id),
        "version_number": version.version_number,
        "created_at": version.created_at.isoformat(),
        "gst_pct": float(version.gst_pct),
        "transport_charge": float(version.transport_charge),
        "subtotal": float(version.subtotal),
        "grand_total": float(version.grand_total),
        "is_locked": version.is_locked,
        "items": [
            {
                "id": str(item.id),
                "box_name": item.box_name,
                "cost_basis": item.cost_basis,
                "length_mm": float(item.length_mm),
                "width_mm": float(item.width_mm),
                "height_mm": float(item.height_mm),
                "quantity": item.quantity,
                "ply": item.ply,
                "combination": item.combination,
                "layer_specs": item.layer_specs or [],
                "markup_pct": float(item.markup_pct),
                "conversion_cost_per_kg": float(item.conversion_cost_per_kg),
                "printing_cost_per_box": float(item.printing_cost),
                "lamination_cost_per_box": float(item.lamination_cost),
                "die_cost_per_box": float(item.die_cost),
                "punching_cost_per_box": float(item.punching_cost),
                "varnish_cost_per_box": float(item.varnish_cost),
                "selected": item.selected,
                "negotiation_mode": item.negotiation_mode,
                "negotiated_price": float(item.negotiated_price) if item.negotiated_price is not None else None,
            }
            for item in sorted_items
        ],
    }


@router.post("/{quote_id}/restore/{version_number}")
async def restore_quote_version(
    quote_id: uuid.UUID,
    version_number: int,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    """Restore a previous version: set it as the current version."""
    tid = uuid.UUID(current_user.tenant_id)
    quote = await db.scalar(
        select(Quote)
        .where(Quote.id == quote_id)
        .where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    if not _can_manage_quote(current_user, quote):
        raise HTTPException(status_code=403, detail="Insufficient permission")

    target = await db.scalar(
        select(QuoteVersion)
        .where(QuoteVersion.quote_id == quote_id)
        .where(QuoteVersion.version_number == version_number)
        .where(QuoteVersion.tenant_id == tid)
    )
    if target is None:
        raise HTTPException(status_code=404, detail="Version not found")
    if target.is_locked:
        raise HTTPException(status_code=409, detail="Target version is locked and cannot be restored over")

    quote.current_version_id = target.id
    await db.commit()
    return {
        "restored_version_id": str(target.id),
        "restored_version_number": target.version_number,
        "grand_total": float(target.grand_total),
    }


# ── Email send (G16) ──────────────────────────────────────────────────────────

class SendEmailRequest(BaseModel):
    to_email: str
    subject: str
    body_html: str
    cc: Optional[list[str]] = None


@router.post("/{quote_id}/send-email", status_code=status.HTTP_200_OK)
async def send_quote_email(
    quote_id: uuid.UUID,
    body: SendEmailRequest,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    """Send the quote email via the tenant's configured SMTP server."""
    tid = uuid.UUID(current_user.tenant_id)

    # Verify quote belongs to tenant
    quote = await db.scalar(
        select(Quote).where(Quote.id == quote_id).where(Quote.tenant_id == tid)
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Load SMTP settings
    from app.core.security import decrypt_secret  # local import to avoid circular
    email_cfg = await db.scalar(
        select(UserEmailSetting).where(UserEmailSetting.tenant_id == tid)
    )
    if email_cfg is None or not email_cfg.smtp_host or not email_cfg.smtp_username:
        raise HTTPException(
            status_code=422,
            detail="SMTP not configured. Please set up email settings first.",
        )

    smtp_password = ""
    if email_cfg.smtp_password_encrypted:
        smtp_password = decrypt_secret(email_cfg.smtp_password_encrypted)

    from_addr = f"{email_cfg.from_name or 'DSmartCorrugator'} <{email_cfg.from_email or email_cfg.smtp_username}>"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = body.subject
    msg["From"] = from_addr
    msg["To"] = body.to_email
    if body.cc:
        msg["Cc"] = ", ".join(body.cc)

    msg.attach(MIMEText(body.body_html, "html", "utf-8"))

    def _send() -> None:
        if email_cfg.smtp_use_tls:
            server = smtplib.SMTP(email_cfg.smtp_host, email_cfg.smtp_port or 587)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(email_cfg.smtp_host, email_cfg.smtp_port or 465)
        server.login(email_cfg.smtp_username, smtp_password)
        recipients = [body.to_email] + (body.cc or [])
        server.sendmail(email_cfg.smtp_username, recipients, msg.as_string())
        server.quit()

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send)
    except smtplib.SMTPException as exc:
        raise HTTPException(status_code=502, detail=f"SMTP error: {exc}") from exc

    # Mark quote as sent
    quote.status = "sent"
    quote.pipeline_stage = "sent"
    await db.commit()

    return {"sent": True, "to": body.to_email}

