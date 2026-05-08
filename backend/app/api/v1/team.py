"""Team management API: invite, list members, change role, remove."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rbac import SessionUser, require_role
from app.database import get_db
from app.models.tenant import Invitation, TenantMembership, User

router = APIRouter(prefix="/team", tags=["team"])

INVITE_EXPIRY_DAYS = 7


# ── List Members ──────────────────────────────────────────────────────────────

@router.get("/members")
async def list_members(
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    rows = (
        await db.scalars(
            select(TenantMembership, User)
            .join(User, TenantMembership.user_id == User.id)
            .where(TenantMembership.tenant_id == tid)
            .order_by(TenantMembership.joined_at)
        )
    ).all()

    result = []
    for row in rows:
        if isinstance(row, tuple):
            membership, user = row[0], row[1]
        else:
            membership = row
            user = None
        result.append({
            "membership_id": str(membership.id),
            "user_id": str(membership.user_id),
            "email": user.email if user else None,
            "display_name": user.display_name if user else None,
            "role": membership.role,
            "is_suspended": membership.is_suspended,
            "joined_at": membership.joined_at.isoformat() if membership.joined_at else None,
        })
    return result


# ── Pending Invitations ───────────────────────────────────────────────────────

@router.get("/invitations")
async def list_invitations(
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    rows = (
        await db.scalars(
            select(Invitation)
            .where(Invitation.tenant_id == tid)
            .where(Invitation.accepted_at == None)  # noqa: E711
            .where(Invitation.expires_at > datetime.now(timezone.utc))
            .order_by(Invitation.created_at.desc())
        )
    ).all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "role": r.role,
            "expires_at": r.expires_at.isoformat(),
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


# ── Invite Member ─────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "salesperson"


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_member(
    body: InviteRequest,
    background_tasks: BackgroundTasks,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Create an invitation and (in background) send email with invite link."""
    valid_roles = {"viewer", "salesperson", "manager", "admin"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {valid_roles}")

    tid = uuid.UUID(current_user.tenant_id)
    email = body.email.lower()

    # Check if already a member
    existing_user = await db.scalar(select(User).where(User.email == email))
    if existing_user:
        existing_membership = await db.scalar(
            select(TenantMembership)
            .where(TenantMembership.tenant_id == tid)
            .where(TenantMembership.user_id == existing_user.id)
        )
        if existing_membership:
            raise HTTPException(status_code=409, detail="User is already a team member")

    # Invalidate any pending invitations for same email+tenant
    existing_invites = (
        await db.scalars(
            select(Invitation)
            .where(Invitation.tenant_id == tid)
            .where(Invitation.email == email)
            .where(Invitation.accepted_at == None)  # noqa: E711
        )
    ).all()
    for old in existing_invites:
        await db.delete(old)

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    invite = Invitation(
        tenant_id=tid,
        email=email,
        role=body.role,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRY_DAYS),
        invited_by=uuid.UUID(current_user.user_id),
    )
    db.add(invite)
    await db.commit()

    # TODO: background_tasks.add_task(send_invite_email, email, raw_token)

    return {"message": "Invitation sent", "invite_id": str(invite.id)}


# ── Change Role ───────────────────────────────────────────────────────────────

class ChangeRoleRequest(BaseModel):
    role: str


@router.patch("/members/{membership_id}/role")
async def change_member_role(
    membership_id: uuid.UUID,
    body: ChangeRoleRequest,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    valid_roles = {"viewer", "salesperson", "manager", "admin"}
    if body.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of {valid_roles}")

    tid = uuid.UUID(current_user.tenant_id)
    membership = await db.scalar(
        select(TenantMembership)
        .where(TenantMembership.id == membership_id)
        .where(TenantMembership.tenant_id == tid)
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")

    # Cannot change the owner role
    if membership.role == "owner":
        raise HTTPException(status_code=403, detail="Cannot change owner role")

    membership.role = body.role
    await db.commit()
    return {"message": "Role updated"}


# ── Suspend / Unsuspend ───────────────────────────────────────────────────────

@router.patch("/members/{membership_id}/suspend")
async def suspend_member(
    membership_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    membership = await db.scalar(
        select(TenantMembership)
        .where(TenantMembership.id == membership_id)
        .where(TenantMembership.tenant_id == tid)
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    if membership.role == "owner":
        raise HTTPException(status_code=403, detail="Cannot suspend owner")
    if str(membership.user_id) == current_user.user_id:
        raise HTTPException(status_code=403, detail="Cannot suspend yourself")

    membership.is_suspended = True
    await db.commit()
    return {"message": "Member suspended"}


@router.patch("/members/{membership_id}/unsuspend")
async def unsuspend_member(
    membership_id: uuid.UUID,
    current_user: SessionUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    tid = uuid.UUID(current_user.tenant_id)
    membership = await db.scalar(
        select(TenantMembership)
        .where(TenantMembership.id == membership_id)
        .where(TenantMembership.tenant_id == tid)
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")
    membership.is_suspended = False
    await db.commit()
    return {"message": "Member unsuspended"}
