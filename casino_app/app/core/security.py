import asyncio
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Annotated

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

if TYPE_CHECKING:
    from app.models.user import User

_ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)
_bearer = HTTPBearer(auto_error=True)

# ---------------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------------


def make_dummy_hash(plain: str) -> str:
    """Sync — solo para inicialización de módulo. En handlers usa hash_password()."""
    return _ph.hash(plain)


async def hash_password(plain: str) -> str:
    return await asyncio.to_thread(_ph.hash, plain)


async def verify_password(plain: str, hashed: str) -> bool:
    try:
        return await asyncio.to_thread(_ph.verify, hashed, plain)
    except VerifyMismatchError:
        return False


def needs_rehash(hashed: str) -> bool:
    return _ph.check_needs_rehash(hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "role": role,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": now,
        "type": "access",
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithms=[settings.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise JWTError("Invalid token type")
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


# ---------------------------------------------------------------------------
# Dependencias FastAPI
# ---------------------------------------------------------------------------

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token inválido o expirado",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":
    """Valida el JWT y retorna el usuario activo correspondiente."""
    from app.models.user import User  # importación diferida para evitar ciclos

    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError:
        raise _UNAUTHORIZED

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise _UNAUTHORIZED

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise _UNAUTHORIZED

    return user


def require_role(*roles: str):
    """
    Dependencia de autorización por rol.

    Uso:
        @router.get("/admin")
        async def admin_only(user: Annotated[User, Depends(require_role("admin"))]):
            ...
    """

    async def _check(user: Annotated["User", Depends(get_current_user)]) -> "User":
        if user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permisos insuficientes",
            )
        return user

    return _check
