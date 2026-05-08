"""Role-based access control (RBAC) FastAPI dependencies."""
from __future__ import annotations

from fastapi import Cookie, Depends, HTTPException, Request, status

from app.core.session import get_session

# Role hierarchy — higher index = more permissions
ROLE_HIERARCHY = ["viewer", "salesperson", "manager", "admin", "owner"]

# Map of roles that may perform each action (inclusive of higher roles)
ROLE_LEVEL: dict[str, int] = {r: i for i, r in enumerate(ROLE_HIERARCHY)}


class SessionUser:
    """Hydrated session user attached to request state."""

    def __init__(self, data: dict):
        self.user_id: str = data["user_id"]
        self.tenant_id: str = data["tenant_id"]
        self.email: str = data["email"]
        self.role: str = data["role"]
        self.display_name: str = data.get("display_name", "")
        self.plan: str = data.get("plan", "starter")
        self.currency_code: str = data.get("currency_code", "INR")
        self.locale: str = data.get("locale", "en-IN")

    def has_role(self, minimum_role: str) -> bool:
        return ROLE_LEVEL.get(self.role, -1) >= ROLE_LEVEL.get(minimum_role, 999)


async def get_current_session(
    request: Request,
    bcp_session: str | None = Cookie(default=None, alias="bcp_session"),
) -> SessionUser:
    """
    FastAPI dependency: read session cookie, validate against Redis, return SessionUser.
    Raises 401 if not authenticated.
    """
    # Support both cookie and Authorization: Bearer header (for API clients)
    token = bcp_session
    if token is None:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    data = await get_session(token)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    return SessionUser(data)


def require_role(minimum_role: str):
    """
    FastAPI dependency factory: require at least `minimum_role` to access endpoint.
    Usage: Depends(require_role("manager"))
    """
    async def _check(user: SessionUser = Depends(get_current_session)) -> SessionUser:
        if not user.has_role(minimum_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role '{minimum_role}' or higher",
            )
        return user

    return _check


# Convenience pre-built dependencies
require_viewer = Depends(require_role("viewer"))
require_salesperson = Depends(require_role("salesperson"))
require_manager = Depends(require_role("manager"))
require_admin = Depends(require_role("admin"))
require_owner = Depends(require_role("owner"))
