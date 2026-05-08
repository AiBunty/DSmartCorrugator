"""
Session + Tenant middleware.

For each request:
1. Reads session cookie → loads user context from Redis.
2. Sets `request.state.session_user` (or None if unauthenticated).
3. Sets response headers: X-User-Role, X-Tenant-Id, X-Plan.

The `SET LOCAL app.tenant_id` RLS enforcement is done at the DB dependency level
(see database.py get_db_for_tenant) to keep it within the transaction scope.
"""
from __future__ import annotations

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.core.session import get_session

SETTINGS = get_settings()


class SessionTenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        token = request.cookies.get(SETTINGS.SESSION_COOKIE_NAME)
        if not token:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth[7:]

        session_data = None
        if token:
            session_data = await get_session(token)

        request.state.session_user = session_data
        request.state.session_token = token if session_data else None

        response: Response = await call_next(request)

        if session_data:
            response.headers["X-User-Role"] = session_data.get("role", "")
            response.headers["X-Tenant-Id"] = session_data.get("tenant_id", "")
            response.headers["X-Plan"] = session_data.get("plan", "")

        return response
