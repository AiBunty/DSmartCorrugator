"""Settings API: business defaults, quote terms, email settings, company profile, AI provider, signatures, and templates."""
from __future__ import annotations

import re
import uuid
from html import escape
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import httpx

from app.core.rbac import SessionUser, require_role
from app.core.security import decrypt_secret, encrypt_secret
from app.database import get_db
from app.models.quote import Quote, QuoteItem, QuoteVersion
from app.models.settings import (
    AiProviderSetting,
    BusinessDefault,
    CompanyProfile,
    MessageTemplate,
    TenantSignatureSetting,
    UserEmailSetting,
    UserQuoteTerm,
)

router = APIRouter(prefix="/settings", tags=["settings"])

ALLOWED_TEMPLATE_CHANNELS = {"email", "whatsapp"}
VARIABLE_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}")
TAG_RE = re.compile(r"<[^>]+>")
SCRIPT_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
EVENT_HANDLER_RE = re.compile(r"\son[a-zA-Z]+\s*=\s*(['\"]).*?\1", re.IGNORECASE | re.DOTALL)
JS_PROTOCOL_RE = re.compile(r"javascript:\s*", re.IGNORECASE)

PRESET_TEMPLATES: dict[str, list[dict[str, str | None]]] = {
    "email": [
        {"key": "formal-quote", "name": "Formal Quote", "subject": "Quote {{quote.quote_no}} from {{company.company_name}}", "body_html": "<p>Dear {{party.person_name}},</p><p>Please find your quote <strong>{{quote.quote_no}}</strong> for review.</p><p>Total: <strong>{{version.grand_total}}</strong></p>"},
        {"key": "compact-summary", "name": "Compact Summary", "subject": "Quick quote summary: {{quote.quote_no}}", "body_html": "<p>Hello {{party.person_name}},</p><p>Sharing a quick summary for {{quote.quote_no}} with total {{version.grand_total}}.</p>"},
        {"key": "premium-brand", "name": "Premium Brand", "subject": "Tailored packaging quote for {{party.company_name}}", "body_html": "<h2>Packaging Proposal</h2><p>We are pleased to share a tailored quotation for your packaging requirement.</p>"},
        {"key": "table-layout", "name": "Table Layout", "subject": "Detailed quote {{quote.quote_no}}", "body_html": "<p>Dear {{party.person_name}},</p><table><tr><th>Quote</th><th>Total</th></tr><tr><td>{{quote.quote_no}}</td><td>{{version.grand_total}}</td></tr></table>"},
        {"key": "follow-up", "name": "Follow-up", "subject": "Following up on quote {{quote.quote_no}}", "body_html": "<p>Hello {{party.person_name}},</p><p>Following up on the quote we shared earlier. Let us know if you need any changes.</p>"},
        {"key": "reminder", "name": "Reminder", "subject": "Reminder: quote {{quote.quote_no}}", "body_html": "<p>This is a quick reminder regarding quote {{quote.quote_no}}.</p>"},
        {"key": "negotiation", "name": "Negotiation", "subject": "Revised commercial proposal {{quote.quote_no}}", "body_html": "<p>We have prepared a commercial draft for discussion on {{quote.quote_no}}.</p>"},
        {"key": "thank-you", "name": "Thank You", "subject": "Thank you for considering {{company.company_name}}", "body_html": "<p>Thank you for considering our quotation.</p>"},
        {"key": "friendly", "name": "Friendly Tone", "subject": "Sharing your box quote {{quote.quote_no}}", "body_html": "<p>Hi {{party.person_name}},</p><p>Sharing your quote with all key details below.</p>"},
        {"key": "manufacturing-focus", "name": "Manufacturing Focus", "subject": "Technical and commercial quote {{quote.quote_no}}", "body_html": "<p>Attached is the technical-commercial quote including board and box details.</p>"},
        {"key": "short-cfo", "name": "Short CFO Style", "subject": "Commercial quote {{quote.quote_no}}", "body_html": "<p>Quote {{quote.quote_no}} total: {{version.grand_total}}.</p><p>Reply for the detailed breakup.</p>"},
        {"key": "introductory", "name": "Introductory", "subject": "Introduction and quote {{quote.quote_no}}", "body_html": "<p>It was a pleasure connecting with you. Please find our quote enclosed.</p>"},
        {"key": "urgent", "name": "Urgent Delivery", "subject": "Priority quote {{quote.quote_no}}", "body_html": "<p>Sharing the requested priority quote for immediate review.</p>"},
        {"key": "comparison", "name": "Comparison Note", "subject": "Quote comparison summary {{quote.quote_no}}", "body_html": "<p>Sharing a summary to help compare this quotation with your current benchmark.</p>"},
        {"key": "emoji-light", "name": "Emoji Light", "subject": "Your quote is ready {{quote.quote_no}}", "body_html": "<p>Hello {{party.person_name}},</p><p>Your packaging quote is ready. We would be glad to discuss next steps.</p>"},
    ],
    "whatsapp": [
        {"key": "wa-formal", "name": "Formal WhatsApp", "subject": None, "body_html": "<p>Dear {{party.person_name}},</p><p>Greetings from {{company.company_name}}.</p><p>Please find the quotation details below:</p><p>*Quote No:* {{quote.quote_no}}<br/>*Amount:* {{version.grand_total}}<br/>*Valid Until:* {{quote.valid_until}}</p><p>Kindly revert with your confirmation at the earliest.</p><p>Regards,<br/>{{user.name}}<br/>{{company.company_name}}</p>"},
        {"key": "wa-compact", "name": "Compact WhatsApp", "subject": None, "body_html": "<p>Hi {{party.person_name}},</p><p>Quote *{{quote.quote_no}}* — Total: *{{version.grand_total}}*</p><p>Valid till {{quote.valid_until}}. Let us know to proceed.</p>"},
        {"key": "wa-follow-up", "name": "Follow-up WhatsApp", "subject": None, "body_html": "<p>Hello {{party.person_name}},</p><p>Following up on Quote *{{quote.quote_no}}* shared earlier.</p><p>Total: *{{version.grand_total}}*</p><p>Please let us know if you have any questions or need any revision. We look forward to your confirmation.</p><p>— {{user.name}}, {{company.company_name}}</p>"},
        {"key": "wa-reminder", "name": "Reminder WhatsApp", "subject": None, "body_html": "<p>Hi {{party.person_name}},</p><p>⏰ Quick reminder: Quote *{{quote.quote_no}}* is valid until {{quote.valid_until}}.</p><p>Total: *{{version.grand_total}}*</p><p>Reply to confirm or ask for changes.</p>"},
        {"key": "wa-negotiation", "name": "Negotiation WhatsApp", "subject": None, "body_html": "<p>Hello {{party.person_name}},</p><p>We have prepared a revised commercial draft for *{{quote.quote_no}}*.</p><p>Revised Total: *{{version.grand_total}}*</p><p>We are open to discussion. Please share your feedback and we will do our best to accommodate your requirements.</p><p>Regards,<br/>{{user.name}}</p>"},
        {"key": "wa-premium", "name": "Premium Brand WhatsApp", "subject": None, "body_html": "<p>Dear {{party.person_name}},</p><p>{{company.company_name}} is pleased to present a tailored packaging quotation for your requirement.</p><p>*Quote:* {{quote.quote_no}}<br/>*Value:* {{version.grand_total}}</p><p>Our team ensures the highest quality at competitive pricing. We look forward to a long-term partnership.</p><p>Best regards,<br/>{{user.name}}</p>"},
        {"key": "wa-friendly", "name": "Friendly WhatsApp", "subject": None, "body_html": "<p>Hey {{party.person_name}} 👋</p><p>Here is the quote you asked for!</p><p>*{{quote.quote_no}}* — *{{version.grand_total}}*</p><p>Let me know if anything needs tweaking. Happy to help! 😊</p><p>— {{user.name}}</p>"},
        {"key": "wa-emoji", "name": "Emoji WhatsApp", "subject": None, "body_html": "<p>Hi {{party.person_name}} 😊</p><p>📦 *Packaging Quote Ready!*</p><p>🔢 Quote: *{{quote.quote_no}}*<br/>💰 Total: *{{version.grand_total}}*<br/>📅 Valid: {{quote.valid_until}}</p><p>✅ Reply *YES* to confirm or ask for changes anytime!</p>"},
        {"key": "wa-short", "name": "Short Commercial", "subject": None, "body_html": "<p>{{party.person_name}}, quote *{{quote.quote_no}}* — *{{version.grand_total}}*. Valid till {{quote.valid_until}}. Confirm?</p>"},
        {"key": "wa-table", "name": "Table Style", "subject": None, "body_html": "<p>Hi {{party.person_name}},</p><p>*Quote Summary — {{quote.quote_no}}*</p><p>━━━━━━━━━━━━━━━━━<br/>Quote No: {{quote.quote_no}}<br/>Party: {{party.company_name}}<br/>Total: {{version.grand_total}}<br/>Valid Until: {{quote.valid_until}}<br/>━━━━━━━━━━━━━━━━━</p><p>Please review and confirm at your convenience.</p>"},
        {"key": "wa-urgent", "name": "Urgent WhatsApp", "subject": None, "body_html": "<p>Hello {{party.person_name}},</p><p>🚨 *Priority Quote — {{quote.quote_no}}*</p><p>As requested, sharing the priority quote for immediate review.</p><p>Amount: *{{version.grand_total}}*<br/>Valid: {{quote.valid_until}}</p><p>Please confirm ASAP so we can proceed with production planning.</p>"},
        {"key": "wa-intro", "name": "Introductory WhatsApp", "subject": None, "body_html": "<p>Hello {{party.person_name}},</p><p>It was a pleasure connecting with you! I am {{user.name}} from {{company.company_name}}.</p><p>As discussed, sharing our quotation *{{quote.quote_no}}* for your requirement.</p><p>Total: *{{version.grand_total}}* | Valid till: {{quote.valid_until}}</p><p>Looking forward to working with you!</p>"},
        {"key": "wa-thank-you", "name": "Thank You WhatsApp", "subject": None, "body_html": "<p>Dear {{party.person_name}},</p><p>🙏 Thank you for considering {{company.company_name}} for your packaging needs!</p><p>Quote *{{quote.quote_no}}* — *{{version.grand_total}}*</p><p>We assure you of the best quality and service. Please feel free to reach out for any queries.</p>"},
        {"key": "wa-comparison", "name": "Comparison WhatsApp", "subject": None, "body_html": "<p>Hello {{party.person_name}},</p><p>Sharing Quote *{{quote.quote_no}}* to help you compare with your current benchmark.</p><p>Our offer: *{{version.grand_total}}*</p><p>We are confident in the quality and value we provide. Happy to discuss further!</p>"},
        {"key": "wa-summary", "name": "Summary WhatsApp", "subject": None, "body_html": "<p>Hi {{party.person_name}},</p><p>*Quick Summary — {{quote.quote_no}}*</p><p>Here is a brief overview of the quotation we prepared for you:</p><p>• Total Amount: *{{version.grand_total}}*<br/>• Valid Until: {{quote.valid_until}}<br/>• Party: {{party.company_name}}</p><p>Reply for the detailed breakup or to make any changes.</p>"},
    ],
}


def _extract_variables(*values: str | None) -> list[str]:
    found: set[str] = set()
    for value in values:
        if not value:
            continue
        found.update(VARIABLE_RE.findall(value))
    return sorted(found)


def _sanitize_html(value: str | None) -> str | None:
    if value is None:
        return None
    sanitized = SCRIPT_RE.sub("", value)
    sanitized = EVENT_HANDLER_RE.sub("", sanitized)
    sanitized = JS_PROTOCOL_RE.sub("", sanitized)
    return sanitized.strip()


def _html_to_plain_text(value: str | None) -> str | None:
    if value is None:
        return None
    no_tags = TAG_RE.sub("", value)
    no_tags = no_tags.replace("&nbsp;", " ")
    return re.sub(r"\n{3,}", "\n\n", no_tags).strip()


def _normalize_whatsapp_text(value: str | None) -> str | None:
    plain_text = _html_to_plain_text(value)
    if plain_text is None:
        return None
    return re.sub(r"\r\n?", "\n", plain_text).strip()


def _template_to_response(template: MessageTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "name": template.name,
        "channel": template.channel,
        "subject": template.subject,
        "body_html": template.body_html,
        "body_text": template.body_text,
        "variables": template.variables or [],
        "is_default": template.is_default,
        "source_preset_key": template.source_preset_key,
        "created_at": template.created_at.isoformat(),
        "updated_at": template.updated_at.isoformat(),
    }


async def _get_quote_context(db: AsyncSession, tenant_id: uuid.UUID, quote_id: uuid.UUID) -> dict[str, Any]:
    quote = await db.scalar(
        select(Quote)
        .where(Quote.id == quote_id)
        .where(Quote.tenant_id == tenant_id)
        .options(selectinload(Quote.party))
        .options(selectinload(Quote.versions).selectinload(QuoteVersion.items))
    )
    if quote is None:
        raise HTTPException(status_code=404, detail="Quote not found")
    current_version = next((v for v in quote.versions if v.id == quote.current_version_id), None)
    if current_version is None and quote.versions:
        current_version = sorted(quote.versions, key=lambda version: version.version_number)[-1]
    if current_version is None:
        raise HTTPException(status_code=422, detail="Quote has no saved version to draft from")

    items = [
        {
            "box_name": item.box_name,
            "description": item.description,
            "quantity": item.quantity,
            "ply": item.ply,
            "combination": item.combination,
            "sheet_length_mm": float(item.sheet_length_mm),
            "sheet_width_mm": float(item.sheet_width_mm),
            "final_cost_per_box": float(item.final_cost_per_box),
        }
        for item in sorted(current_version.items, key=lambda row: row.sort_order)
        if item.selected is not False
    ]
    return {
        "quote": {
            "id": str(quote.id),
            "quote_no": quote.quote_no,
            "status": quote.status,
        },
        "party": current_version.party_snapshot or {},
        "company": current_version.company_snapshot or {},
        "version": {
            "id": str(current_version.id),
            "version_number": current_version.version_number,
            "grand_total": float(current_version.grand_total),
            "subtotal": float(current_version.subtotal),
            "gst_amount": float(current_version.gst_amount),
            "validity_days": current_version.validity_days,
            "payment_terms": current_version.payment_terms,
            "delivery_terms": current_version.delivery_terms,
            "other_terms": current_version.other_terms,
            "items": items,
        },
    }


def _quote_context_text(context: dict[str, Any]) -> str:
    items_summary = "\n".join(
        f"- {item['box_name'] or 'Box'} | qty {item['quantity']} | ply {item['ply']} | combo {item['combination']} | cost/box {item['final_cost_per_box']}"
        for item in context["version"]["items"]
    )
    return (
        f"Quote No: {context['quote']['quote_no']}\n"
        f"Status: {context['quote']['status']}\n"
        f"Party: {context['party'].get('person_name') or context['party'].get('company_name') or 'N/A'}\n"
        f"Company: {context['company'].get('company_name') or 'N/A'}\n"
        f"Grand Total: {context['version']['grand_total']}\n"
        f"Validity Days: {context['version']['validity_days']}\n"
        f"Payment Terms: {context['version'].get('payment_terms') or 'N/A'}\n"
        f"Delivery Terms: {context['version'].get('delivery_terms') or 'N/A'}\n"
        f"Items:\n{items_summary}"
    )


# ── Business Defaults ─────────────────────────────────────────────────────────

class BusinessDefaultUpdate(BaseModel):
    default_markup_pct: Optional[float] = None
    default_conversion_cost_per_kg: Optional[float] = None
    default_gst_pct: Optional[float] = None
    default_currency_code: Optional[str] = None
    default_quantity: Optional[int] = None
    default_validity_days: Optional[int] = None
    quote_number_prefix: Optional[str] = None


@router.get("/defaults")
async def get_defaults(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(BusinessDefault).where(BusinessDefault.tenant_id == tid))
    if row is None:
        raise HTTPException(status_code=404, detail="Business defaults not configured")
    return {
        "default_markup_pct": float(row.default_markup_pct),
        "default_conversion_cost_per_kg": float(row.default_conversion_cost_per_kg),
        "default_gst_pct": float(row.default_gst_pct),
        "default_currency_code": row.default_currency_code,
        "default_quantity": row.default_quantity,
        "default_validity_days": row.default_validity_days,
        "quote_number_prefix": row.quote_number_prefix,
    }


@router.patch("/defaults")
async def update_defaults(
    body: BusinessDefaultUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(BusinessDefault).where(BusinessDefault.tenant_id == tid))
    if row is None:
        raise HTTPException(status_code=404, detail="Business defaults not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    await db.commit()
    return {"message": "Saved"}


# ── Quote Terms ───────────────────────────────────────────────────────────────

class QuoteTermsUpdate(BaseModel):
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    other_terms: Optional[str] = None


@router.get("/quote-terms")
async def get_quote_terms(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(UserQuoteTerm).where(UserQuoteTerm.tenant_id == tid))
    if row is None:
        return {}
    return {
        "payment_terms": row.payment_terms,
        "delivery_terms": row.delivery_terms,
        "other_terms": row.other_terms,
    }


@router.put("/quote-terms")
async def upsert_quote_terms(
    body: QuoteTermsUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(UserQuoteTerm).where(UserQuoteTerm.tenant_id == tid))
    if row is None:
        row = UserQuoteTerm(tenant_id=tid)
        db.add(row)
    row.payment_terms = body.payment_terms
    row.delivery_terms = body.delivery_terms
    row.other_terms = body.other_terms
    await db.commit()
    return {"message": "Saved"}


# ── Company Profile ───────────────────────────────────────────────────────────

class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    gstin: Optional[str] = None
    bank_details: Optional[dict] = None


@router.get("/company")
async def get_company_profile(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(CompanyProfile).where(CompanyProfile.tenant_id == tid))
    if row is None:
        return {}
    return {
        "company_name": row.company_name,
        "address": row.address,
        "phone": row.phone,
        "email": row.email,
        "website": row.website,
        "gstin": row.gstin,
        "bank_details": row.bank_details,
        "logo_s3_key": row.logo_s3_key,
    }


@router.patch("/company")
async def update_company_profile(
    body: CompanyProfileUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(CompanyProfile).where(CompanyProfile.tenant_id == tid))
    if row is None:
        row = CompanyProfile(tenant_id=tid)
        db.add(row)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(row, k, v)
    await db.commit()
    return {"message": "Saved"}


# ── Email Settings ────────────────────────────────────────────────────────────

class EmailSettingUpdate(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: str
    smtp_password: str   # plain-text input, encrypted before storage
    use_tls: bool = True
    from_email: EmailStr
    from_name: Optional[str] = None


@router.get("/email")
async def get_email_settings(
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Returns email settings WITHOUT the plaintext password."""
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(UserEmailSetting).where(UserEmailSetting.tenant_id == tid))
    if row is None:
        return {}
    return {
        "smtp_host": row.smtp_host,
        "smtp_port": row.smtp_port,
        "smtp_username": row.smtp_username,
        "use_tls": row.smtp_use_tls,
        "from_email": row.from_email,
        "from_name": row.from_name,
        "is_configured": bool(row.smtp_host and row.smtp_username and row.smtp_password_encrypted),
    }


@router.put("/email")
async def upsert_email_settings(
    body: EmailSettingUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(UserEmailSetting).where(UserEmailSetting.tenant_id == tid))
    if row is None:
        row = UserEmailSetting(tenant_id=tid)
        db.add(row)

    row.smtp_host = body.smtp_host
    row.smtp_port = body.smtp_port
    row.smtp_username = body.smtp_username
    row.smtp_password_encrypted = encrypt_secret(body.smtp_password)
    row.smtp_use_tls = body.use_tls
    row.from_email = str(body.from_email)
    row.from_name = body.from_name

    await db.commit()
    return {"message": "Saved"}


class AiProviderUpdate(BaseModel):
    provider_name: str = "openai"
    api_key: Optional[str] = None
    model_name: str = "gpt-4.1-mini"
    is_enabled: bool = True


@router.get("/ai-provider")
async def get_ai_provider_settings(
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(AiProviderSetting).where(AiProviderSetting.tenant_id == tid))
    if row is None:
        return {
            "provider_name": "openai",
            "model_name": "gpt-4.1-mini",
            "is_enabled": False,
            "is_configured": False,
        }
    return {
        "provider_name": row.provider_name,
        "model_name": row.model_name,
        "is_enabled": row.is_enabled,
        "is_configured": bool(row.api_key_encrypted),
    }


@router.put("/ai-provider")
async def upsert_ai_provider_settings(
    body: AiProviderUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.provider_name.lower() != "openai":
        raise HTTPException(status_code=422, detail="Phase 1 supports OpenAI only")
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(AiProviderSetting).where(AiProviderSetting.tenant_id == tid))
    if row is None:
        row = AiProviderSetting(tenant_id=tid)
        db.add(row)

    incoming_key = (body.api_key or "").strip()
    has_existing_key = bool(row.api_key_encrypted)
    if body.is_enabled and not incoming_key and not has_existing_key:
        raise HTTPException(status_code=422, detail="API key is required when AI provider is enabled")

    row.provider_name = body.provider_name.lower()
    row.model_name = body.model_name
    row.is_enabled = body.is_enabled
    if incoming_key:
        row.api_key_encrypted = encrypt_secret(incoming_key)
    await db.commit()
    return {"message": "Saved"}


class SignatureSettingsUpdate(BaseModel):
    email_signature_html: Optional[str] = None
    whatsapp_signature_text: Optional[str] = None
    email_signature_label: Optional[str] = None
    whatsapp_signature_label: Optional[str] = None


@router.get("/signatures")
async def get_signature_settings(
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(TenantSignatureSetting).where(TenantSignatureSetting.tenant_id == tid))
    if row is None:
        return {
            "email_signature_html": None,
            "whatsapp_signature_text": None,
            "email_signature_label": None,
            "whatsapp_signature_label": None,
        }
    return {
        "email_signature_html": row.email_signature_html,
        "whatsapp_signature_text": row.whatsapp_signature_text,
        "email_signature_label": row.email_signature_label,
        "whatsapp_signature_label": row.whatsapp_signature_label,
    }


@router.put("/signatures")
async def upsert_signature_settings(
    body: SignatureSettingsUpdate,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    row = await db.scalar(select(TenantSignatureSetting).where(TenantSignatureSetting.tenant_id == tid))
    if row is None:
        row = TenantSignatureSetting(tenant_id=tid)
        db.add(row)
    row.email_signature_html = _sanitize_html(body.email_signature_html)
    row.whatsapp_signature_text = _normalize_whatsapp_text(body.whatsapp_signature_text)
    row.email_signature_label = body.email_signature_label
    row.whatsapp_signature_label = body.whatsapp_signature_label
    await db.commit()
    return {"message": "Saved"}


class MessageTemplateUpsert(BaseModel):
    name: str
    channel: str
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    is_default: bool = False
    source_preset_key: Optional[str] = None


class PresetCloneRequest(BaseModel):
    preset_key: str
    channel: str
    name: Optional[str] = None


@router.get("/templates")
async def list_message_templates(
    channel: Optional[str] = None,
    current_user: SessionUser = Depends(require_role("viewer")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    q = select(MessageTemplate).where(MessageTemplate.tenant_id == tid).order_by(MessageTemplate.updated_at.desc())
    if channel:
        q = q.where(MessageTemplate.channel == channel)
    rows = (await db.scalars(q)).all()
    return [_template_to_response(row) for row in rows]


@router.get("/templates/presets")
async def list_template_presets(
    channel: str,
    current_user: SessionUser = Depends(require_role("viewer")),
):
    if channel not in PRESET_TEMPLATES:
        raise HTTPException(status_code=422, detail="Invalid channel")
    return PRESET_TEMPLATES[channel]


@router.post("/templates")
async def create_message_template(
    body: MessageTemplateUpsert,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    if body.channel not in ALLOWED_TEMPLATE_CHANNELS:
        raise HTTPException(status_code=422, detail="Invalid channel")
    sanitized_html = _sanitize_html(body.body_html)
    normalized_text = _normalize_whatsapp_text(body.body_text or body.body_html)
    template = MessageTemplate(
        tenant_id=uuid.UUID(current_user.tenant_id),
        name=body.name,
        channel=body.channel,
        subject=body.subject,
        body_html=sanitized_html,
        body_text=normalized_text,
        variables=_extract_variables(body.subject, body.body_html, body.body_text),
        is_default=body.is_default,
        source_preset_key=body.source_preset_key,
        created_by=uuid.UUID(current_user.user_id),
        updated_by=uuid.UUID(current_user.user_id),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


@router.post("/templates/clone-preset")
async def clone_template_preset(
    body: PresetCloneRequest,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    presets = PRESET_TEMPLATES.get(body.channel)
    if presets is None:
        raise HTTPException(status_code=422, detail="Invalid channel")
    preset = next((row for row in presets if row["key"] == body.preset_key), None)
    if preset is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    template = MessageTemplate(
        tenant_id=uuid.UUID(current_user.tenant_id),
        name=body.name or str(preset["name"]),
        channel=body.channel,
        subject=preset.get("subject"),
        body_html=_sanitize_html(preset.get("body_html")),
        body_text=_normalize_whatsapp_text(preset.get("body_html") or preset.get("name")),
        variables=_extract_variables(preset.get("subject"), preset.get("body_html")),
        source_preset_key=body.preset_key,
        created_by=uuid.UUID(current_user.user_id),
        updated_by=uuid.UUID(current_user.user_id),
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


@router.patch("/templates/{template_id}")
async def update_message_template(
    template_id: uuid.UUID,
    body: MessageTemplateUpsert,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    template = await db.scalar(
        select(MessageTemplate)
        .where(MessageTemplate.id == template_id)
        .where(MessageTemplate.tenant_id == tid)
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if body.channel not in ALLOWED_TEMPLATE_CHANNELS:
        raise HTTPException(status_code=422, detail="Invalid channel")
    template.name = body.name
    template.channel = body.channel
    template.subject = body.subject
    template.body_html = _sanitize_html(body.body_html)
    template.body_text = _normalize_whatsapp_text(body.body_text or body.body_html)
    template.variables = _extract_variables(body.subject, body.body_html, body.body_text)
    template.is_default = body.is_default
    template.updated_by = uuid.UUID(current_user.user_id)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


@router.delete("/templates/{template_id}")
async def delete_message_template(
    template_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    template = await db.scalar(
        select(MessageTemplate)
        .where(MessageTemplate.id == template_id)
        .where(MessageTemplate.tenant_id == tid)
    )
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"message": "Deleted"}


class AiDraftRequest(BaseModel):
    quote_id: uuid.UUID
    channel: str
    prompt: str
    preset_key: Optional[str] = None
    signature_override: Optional[str] = None


@router.post("/ai-draft")
async def generate_ai_draft(
    body: AiDraftRequest,
    current_user: SessionUser = Depends(require_role("salesperson")),
    db: AsyncSession = Depends(get_db),
):
    if body.channel not in ALLOWED_TEMPLATE_CHANNELS:
        raise HTTPException(status_code=422, detail="Invalid channel")
    tid = uuid.UUID(current_user.tenant_id)
    provider = await db.scalar(select(AiProviderSetting).where(AiProviderSetting.tenant_id == tid))
    if provider is None or not provider.api_key_encrypted or not provider.is_enabled:
        raise HTTPException(status_code=422, detail="OpenAI provider is not configured for this tenant")
    signature_settings = await db.scalar(select(TenantSignatureSetting).where(TenantSignatureSetting.tenant_id == tid))
    quote_context = await _get_quote_context(db, tid, body.quote_id)
    default_signature = None
    if signature_settings:
        default_signature = (
            signature_settings.email_signature_html
            if body.channel == "email"
            else signature_settings.whatsapp_signature_text
        )
    selected_preset = None
    if body.preset_key:
        selected_preset = next(
            (row for row in PRESET_TEMPLATES[body.channel] if row["key"] == body.preset_key),
            None,
        )
    system_prompt = (
        "You draft quote communication messages for a corrugated packaging SaaS. "
        "Use the provided quote context only. Follow the user's prompt precisely. "
        "For email, return JSON with keys subject, body_html, body_text. The HTML may use paragraphs, bold, color-safe spans, lists, and tables. "
        "For WhatsApp, return JSON with keys body_text and styled_preview. Use emojis if asked, keep the output business-ready, and do not use HTML in body_text."
    )
    user_prompt = {
        "channel": body.channel,
        "prompt": body.prompt,
        "preset": selected_preset,
        "signature": body.signature_override or default_signature,
        "quote_context": quote_context,
        "quote_context_text": _quote_context_text(quote_context),
    }

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "template_draft",
            "schema": {
                "type": "object",
                "properties": {
                    "subject": {"type": ["string", "null"]},
                    "body_html": {"type": ["string", "null"]},
                    "body_text": {"type": ["string", "null"]},
                    "styled_preview": {"type": ["string", "null"]},
                },
                "required": ["body_text"],
                "additionalProperties": False,
            },
        },
    }
    api_key = decrypt_secret(provider.api_key_encrypted)
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": provider.model_name,
                "input": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": str(user_prompt)},
                ],
                "text": {"format": response_format},
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OpenAI draft failed: {response.text}")
    payload = response.json()
    output_text = payload.get("output", [])
    json_text = None
    for entry in output_text:
        for part in entry.get("content", []):
            if part.get("type") in {"output_text", "text"}:
                json_text = part.get("text")
                break
        if json_text:
            break
    if not json_text:
        raise HTTPException(status_code=502, detail="OpenAI draft returned no structured content")
    try:
        import json

        draft = json.loads(json_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to parse OpenAI draft: {exc}") from exc
    body_html = _sanitize_html(draft.get("body_html"))
    body_text = _normalize_whatsapp_text(draft.get("body_text") or draft.get("styled_preview") or body_html)
    return {
        "subject": escape(draft.get("subject")) if draft.get("subject") else None,
        "body_html": body_html,
        "body_text": body_text,
        "styled_preview": draft.get("styled_preview") or body_html or body_text,
        "variables": _extract_variables(draft.get("subject"), body_html, body_text),
        "quote_context": quote_context,
    }
