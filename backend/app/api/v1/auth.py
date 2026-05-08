"""Auth API: register, login, logout, change-password, accept-invite, me."""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.rbac import SessionUser, get_current_session
from app.core.security import (
    compare_invite_tokens,
    hash_password,
    verify_password,
)
from app.core.session import create_session, delete_session, rotate_session
from app.database import get_db
from app.models.paper import FluteSetting, PaperBfPrice, PaperPricingRule, ShadePremium
from app.models.tenant import Invitation, Tenant, TenantMembership, User
from app.models.settings import BusinessDefault, UserQuoteTerm

SETTINGS = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    company_name: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class AcceptInviteRequest(BaseModel):
    token: str
    password: str
    display_name: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# ── Helpers ───────────────────────────────────────────────────────────────────

def _slugify(name: str) -> str:
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:80] + "-" + uuid.uuid4().hex[:8]


async def _seed_tenant_defaults(tenant_id: uuid.UUID, db: AsyncSession) -> None:
    """Auto-seed required settings rows when a new tenant is created."""
    # 1. FluteSetting rows
    flute_defaults = [
        ("A", 1.55, 4.8), ("B", 1.35, 2.5), ("C", 1.45, 3.6),
        ("E", 1.25, 1.2), ("F", 1.20, 0.8),
    ]
    for ft, factor, height in flute_defaults:
        db.add(FluteSetting(
            tenant_id=tenant_id,
            flute_type=ft,
            fluting_factor=factor,
            flute_height_mm=height,
        ))

    # 2. ShadePremium rows (11 shades, all ₹0 initially)
    shade_defaults = [
        ("W", "White"), ("K", "Kraft"), ("HW", "Half White"),
        ("HK", "Half Kraft"), ("MG", "Machine Glazed"), ("BF", "Bleached Flour"),
        ("CC", "Chip Board"), ("SC", "Semi Chem"), ("GL", "Glassine"),
        ("ST", "Star"), ("CR", "Cream"),
    ]
    for code, label in shade_defaults:
        db.add(ShadePremium(tenant_id=tenant_id, shade_code=code, shade_label=label, premium=0))

    # 3. BF base prices (required for quote save formula rate resolution)
    bf_defaults = {
        14: 32, 16: 34, 18: 36, 20: 38, 22: 42,
        24: 46, 25: 48, 28: 54, 30: 58, 32: 62,
        35: 70, 40: 80,
    }
    for bf_value, base_price in bf_defaults.items():
        db.add(
            PaperBfPrice(
                tenant_id=tenant_id,
                bf_value=bf_value,
                base_price=base_price,
                is_active=True,
            )
        )

    # 4. Default pricing rule row
    db.add(
        PaperPricingRule(
            tenant_id=tenant_id,
            rule_order=1,
            low_gsm_limit=100,
            high_gsm_limit=200,
            low_gsm_adjustment=0,
            high_gsm_adjustment=0,
            market_adjustment=0,
            is_active=True,
        )
    )

    # 5. BusinessDefault row
    db.add(BusinessDefault(tenant_id=tenant_id))

    # 6. UserQuoteTerm row
    db.add(UserQuoteTerm(
        tenant_id=tenant_id,
        payment_terms="50% advance, balance before dispatch",
        delivery_terms="Ex-works",
        other_terms=None,
    ))


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SETTINGS.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=SETTINGS.is_production,
        samesite="lax",
        max_age=SETTINGS.session_ttl_seconds,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SETTINGS.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=SETTINGS.is_production,
        samesite="lax",
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user and create their tenant."""
    # Check email uniqueness
    existing = await db.scalar(select(User).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    # Create tenant
    tenant = Tenant(
        name=body.company_name,
        slug=_slugify(body.company_name),
        plan="starter",
    )
    db.add(tenant)
    await db.flush()

    # Create user
    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        email_verified=False,
    )
    db.add(user)
    await db.flush()

    # Create owner membership
    membership = TenantMembership(
        tenant_id=tenant.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)

    # Seed defaults
    await _seed_tenant_defaults(tenant.id, db)

    await db.commit()

    # Create session
    token = await create_session({
        "user_id": str(user.id),
        "tenant_id": str(tenant.id),
        "email": user.email,
        "role": "owner",
        "display_name": user.display_name,
        "plan": tenant.plan,
        "currency_code": "INR",
        "locale": "en-IN",
    })
    _set_session_cookie(response, token)

    return {"message": "Registration successful", "tenant_id": str(tenant.id)}


@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and issue session cookie."""
    user = await db.scalar(select(User).where(User.email == body.email.lower()))

    # Use constant-time comparison regardless of whether user exists
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.is_globally_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended"
        )

    # Get first active membership
    membership = await db.scalar(
        select(TenantMembership)
        .where(TenantMembership.user_id == user.id)
        .where(TenantMembership.is_suspended == False)  # noqa: E712
        .order_by(TenantMembership.joined_at)
        .limit(1)
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="No active tenant membership"
        )

    tenant = await db.get(Tenant, membership.tenant_id)

    token = await create_session({
        "user_id": str(user.id),
        "tenant_id": str(tenant.id),
        "email": user.email,
        "role": membership.role,
        "display_name": user.display_name,
        "plan": tenant.plan,
        "currency_code": "INR",
        "locale": membership.preferred_locale or "en-IN",
    })
    _set_session_cookie(response, token)

    return {
        "user_id": str(user.id),
        "display_name": user.display_name,
        "email": user.email,
        "role": membership.role,
        "tenant_id": str(tenant.id),
        "plan": tenant.plan,
    }


@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    bcp_session: str | None = Cookie(default=None, alias="bcp_session"),
):
    """Invalidate session and clear cookie."""
    token = bcp_session or (
        request.headers.get("Authorization", "")[7:]
        if request.headers.get("Authorization", "").startswith("Bearer ")
        else None
    )
    if token:
        await delete_session(token)
    _clear_session_cookie(response)
    return {"message": "Logged out"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    response: Response,
    current_user: SessionUser = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
    bcp_session: str | None = Cookie(default=None, alias="bcp_session"),
):
    """Change authenticated user's password and rotate session."""
    user = await db.get(User, uuid.UUID(current_user.user_id))
    if user is None or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect"
        )

    user.password_hash = hash_password(body.new_password)
    await db.commit()

    # Rotate session to invalidate old token
    new_token = await rotate_session(bcp_session or "", {})
    if new_token:
        _set_session_cookie(response, new_token)

    return {"message": "Password changed successfully"}


@router.post("/accept-invite")
async def accept_invite(
    body: AcceptInviteRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Accept an invitation and create the user account."""
    token_hash = hashlib.sha256(body.token.encode()).hexdigest()
    invite = await db.scalar(
        select(Invitation)
        .where(Invitation.token_hash == token_hash)
        .where(Invitation.accepted_at == None)  # noqa: E711
    )

    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found or already used"
        )

    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Invitation has expired"
        )

    # Check if user with this email already exists
    user = await db.scalar(select(User).where(User.email == invite.email.lower()))
    if user is None:
        user = User(
            email=invite.email.lower(),
            password_hash=hash_password(body.password),
            display_name=body.display_name,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
    else:
        # Existing user joining another tenant — update password if desired
        user.password_hash = hash_password(body.password)
        if body.display_name:
            user.display_name = body.display_name

    # Create membership
    existing_membership = await db.scalar(
        select(TenantMembership)
        .where(TenantMembership.tenant_id == invite.tenant_id)
        .where(TenantMembership.user_id == user.id)
    )
    if existing_membership is None:
        db.add(TenantMembership(
            tenant_id=invite.tenant_id,
            user_id=user.id,
            role=invite.role,
            invited_by=invite.invited_by,
        ))

    invite.accepted_at = datetime.now(timezone.utc)
    await db.commit()

    tenant = await db.get(Tenant, invite.tenant_id)
    token = await create_session({
        "user_id": str(user.id),
        "tenant_id": str(tenant.id),
        "email": user.email,
        "role": invite.role,
        "display_name": user.display_name,
        "plan": tenant.plan,
        "currency_code": "INR",
        "locale": "en-IN",
    })
    _set_session_cookie(response, token)
    return {"message": "Invitation accepted"}


@router.get("/me")
async def me(current_user: SessionUser = Depends(get_current_session)):
    """Return current authenticated user info from session."""
    return {
        "user_id": current_user.user_id,
        "tenant_id": current_user.tenant_id,
        "email": current_user.email,
        "role": current_user.role,
        "display_name": current_user.display_name,
        "plan": current_user.plan,
        "currency_code": current_user.currency_code,
        "locale": current_user.locale,
    }
