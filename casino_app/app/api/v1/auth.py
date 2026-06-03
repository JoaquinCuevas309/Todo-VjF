from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    make_dummy_hash,
    needs_rehash,
    require_role,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
logger = structlog.get_logger()

_MAX_FAILED_ATTEMPTS = 5
_LOCKOUT_MINUTES = 15

# Hash dummy para que "usuario no encontrado" tarde lo mismo que "contraseña incorrecta".
# Se computa una sola vez al arrancar el proceso (make_dummy_hash es síncrono, aceptable aquí).
_DUMMY_HASH: str = make_dummy_hash("dummy_timing_protection_value_x9z!")


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autenticar usuario (RUT o email)",
)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(
    request: Request,
    body: UserLogin,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    identifier = body.identifier.strip()
    is_rut = "-" in identifier and "@" not in identifier

    # Una sola consulta para RUT o email
    stmt = select(User).where(
        or_(
            User.rut == identifier.upper() if is_rut else User.email == identifier.lower(),
        )
    )
    result = await db.execute(stmt)
    user: User | None = result.scalar_one_or_none()

    # ── Usuario no existe: verificar igual contra dummy para igualar tiempos ──
    if user is None:
        await verify_password(body.password.get_secret_value(), _DUMMY_HASH)
        _log_attempt(None, identifier, request, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # ── Cuenta desactivada ──
    if not user.is_active:
        _log_attempt(user.id, identifier, request, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # ── Cuenta bloqueada por exceso de intentos ──
    now = datetime.now(UTC)
    if user.locked_until and user.locked_until > now:
        remaining_min = int((user.locked_until - now).total_seconds() / 60) + 1
        logger.warning("auth.account_locked", user_id=str(user.id))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Cuenta bloqueada. Reintente en {remaining_min} minuto(s).",
        )

    # ── Verificar contraseña ──
    password_ok = await verify_password(body.password.get_secret_value(), user.password_hash)

    if not password_ok:
        user.failed_attempts += 1
        if user.failed_attempts >= _MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)
            logger.warning(
                "auth.account_locked_now",
                user_id=str(user.id),
                failed_attempts=user.failed_attempts,
            )
        await db.commit()
        _log_attempt(user.id, identifier, request, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # ── Login exitoso ──
    user.failed_attempts = 0
    user.locked_until = None

    # Actualizar hash si Argon2 cambió de parámetros
    if needs_rehash(user.password_hash):
        user.password_hash = await hash_password(body.password.get_secret_value())

    await db.commit()
    _log_attempt(user.id, identifier, request, success=True)

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ---------------------------------------------------------------------------
# POST /auth/register  (solo admin puede crear usuarios)
# ---------------------------------------------------------------------------


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario (requiere rol admin)",
)
async def register(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _admin: Annotated[User, Depends(require_role("admin"))],
) -> User:
    # Verificar duplicados
    dup = await db.execute(
        select(User).where(User.rut == body.rut.upper())
    )
    if dup.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese RUT",
        )

    if body.email:
        dup_email = await db.execute(
            select(User).where(User.email == body.email.lower())
        )
        if dup_email.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe un usuario con ese email",
            )

    new_user = User(
        rut=body.rut.upper(),
        email=body.email.lower() if body.email else None,
        full_name=body.full_name,
        password_hash=await hash_password(body.password.get_secret_value()),
        role=body.role,
        created_by=_admin.id,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info("auth.user_created", new_user_id=str(new_user.id), by=str(_admin.id))
    return new_user


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------


@router.get("/me", response_model=UserOut, summary="Perfil del usuario autenticado")
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------


def _log_attempt(user_id, identifier: str, request: Request, *, success: bool) -> None:
    ip = request.client.host if request.client else "unknown"
    # Ofuscar parcialmente el identificador en los logs
    safe_id = identifier[:4] + "***" if len(identifier) > 4 else "***"
    if success:
        logger.info("auth.login_success", user_id=str(user_id), ip=ip)
    else:
        logger.warning(
            "auth.login_failed",
            identifier=safe_id,
            user_id=str(user_id) if user_id else None,
            ip=ip,
        )
