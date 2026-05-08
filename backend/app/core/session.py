"""Redis-backed server-side session management."""
from __future__ import annotations

import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from app.config import get_settings
from app.redis_client import get_redis

SETTINGS = get_settings()
SESSION_PREFIX = "session:"


def _session_key(token: str) -> str:
    return f"{SESSION_PREFIX}{token}"


async def create_session(data: dict[str, Any]) -> str:
    """
    Create a new session. Returns the opaque session token (stored in cookie).
    data must include: user_id, tenant_id, email, role, display_name, plan,
                        currency_code, locale
    """
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        **data,
        "created_at": now,
        "last_active_at": now,
    }
    redis = await get_redis()
    await redis.set(
        _session_key(token),
        json.dumps(payload),
        ex=SETTINGS.session_ttl_seconds,
    )
    return token


async def get_session(token: str) -> dict[str, Any] | None:
    """Retrieve and refresh (rolling TTL) session data. Returns None if expired/missing."""
    redis = await get_redis()
    raw = await redis.get(_session_key(token))
    if raw is None:
        return None
    data: dict = json.loads(raw)

    # Rolling TTL: update last_active_at and reset expiry
    data["last_active_at"] = datetime.now(timezone.utc).isoformat()
    await redis.set(
        _session_key(token),
        json.dumps(data),
        ex=SETTINGS.session_ttl_seconds,
    )
    return data


async def delete_session(token: str) -> None:
    """Invalidate a session (logout)."""
    redis = await get_redis()
    await redis.delete(_session_key(token))


async def rotate_session(old_token: str, updates: dict[str, Any] | None = None) -> str | None:
    """
    Create a new session token while invalidating the old one.
    Used after password changes, role changes, etc.
    Returns new token or None if old session not found.
    """
    data = await get_session(old_token)
    if data is None:
        return None
    await delete_session(old_token)
    if updates:
        data.update(updates)
    return await create_session(data)


async def delete_all_sessions_for_user(user_id: str) -> None:
    """
    Invalidate all sessions for a user (e.g. global logout, password reset).
    Scans Redis for matching keys — acceptable at low session volumes.
    """
    redis = await get_redis()
    cursor = 0
    pattern = f"{SESSION_PREFIX}*"
    while True:
        cursor, keys = await redis.scan(cursor, match=pattern, count=100)
        if keys:
            pipe = redis.pipeline()
            for key in keys:
                pipe.get(key)
            values = await pipe.execute()
            to_delete = []
            for key, raw in zip(keys, values):
                if raw:
                    try:
                        data = json.loads(raw)
                        if data.get("user_id") == user_id:
                            to_delete.append(key)
                    except Exception:
                        pass
            if to_delete:
                await redis.delete(*to_delete)
        if cursor == 0:
            break
