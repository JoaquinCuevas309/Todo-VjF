from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.database import get_db
from app.models.menu import Menu
from app.models.transaction import Reservation, Transaction
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionOut,
    TransactionPage,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])
logger = structlog.get_logger()

_OperatorUser = Annotated[User, Depends(require_role("admin", "operator"))]
_AnyUser = Annotated[User, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Resolución de comensal — tres caminos, un resultado
# ---------------------------------------------------------------------------


async def _resolve_diner(db: AsyncSession, body: TransactionCreate) -> tuple[User, UUID | None]:
    """
    Retorna (comensal, reservation_id).
    Si el identificador es un qr_token, también valida y devuelve el ID de reserva.
    """
    if body.user_id is not None:
        result = await db.execute(select(User).where(User.id == body.user_id))
        diner = result.scalar_one_or_none()
        if diner is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comensal no encontrado")
        return diner, None

    if body.user_rut is not None:
        result = await db.execute(
            select(User).where(User.rut == body.user_rut.upper())
        )
        diner = result.scalar_one_or_none()
        if diner is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Comensal no encontrado")
        return diner, None

    # ── Resolución por qr_token ───────────────────────────────────────────
    res_result = await db.execute(
        select(Reservation).where(Reservation.qr_token == body.qr_token)
    )
    reservation = res_result.scalar_one_or_none()

    if reservation is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "QR inválido o no registrado")

    if reservation.status != "active":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"La reserva ya fue procesada (estado actual: {reservation.status})",
        )

    now = datetime.now(UTC)
    if reservation.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La reserva expiró y ya no es válida",
        )

    # Verificar coherencia: el menú del QR debe coincidir con el menu_id enviado
    if reservation.menu_id != body.menu_id:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "El QR pertenece a un menú diferente al indicado",
        )

    diner_result = await db.execute(select(User).where(User.id == reservation.user_id))
    diner = diner_result.scalar_one()
    return diner, reservation.id


# ---------------------------------------------------------------------------
# POST /transactions  —  registro de consumo (admin / operator)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=TransactionOut,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar consumo (POS)",
)
async def create_transaction(
    body: TransactionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    operator: _OperatorUser,
) -> Transaction:
    # 1. Resolver comensal (sin bloquear aún)
    diner, reservation_id = await _resolve_diner(db, body)

    if not diner.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "El comensal está desactivado y no puede consumir",
        )

    # 2. SELECT FOR UPDATE — bloqueo de fila para prevenir race conditions.
    #    Dos requests simultáneos al mismo menú esperarán turno; el segundo
    #    verá el contador ya incrementado y rechazará correctamente.
    menu_result = await db.execute(
        select(Menu).where(Menu.id == body.menu_id).with_for_update()
    )
    menu: Menu | None = menu_result.scalar_one_or_none()

    if menu is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menú no encontrado")
    if not menu.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "El menú no está activo")

    # 3. Verificación en Python (primera línea de defensa)
    if menu.served_portions >= menu.max_portions:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Sin porciones disponibles — servidas: {menu.served_portions}/{menu.max_portions}",
        )

    # 4. Marcar reserva como consumida si llegó por qr_token
    if body.qr_token and reservation_id:
        res_result = await db.execute(
            select(Reservation).where(Reservation.id == reservation_id)
        )
        reservation = res_result.scalar_one()
        reservation.status = "consumed"
        reservation.consumed_at = datetime.now(UTC)

    # 5. Incrementar contador — la restricción served_lte_max actúa como
    #    segunda línea de defensa si el bloqueo fuera insuficiente (ej. réplicas).
    menu.served_portions += 1

    # 6. Crear transacción (operator_id viene del JWT, nunca del cliente)
    tx = Transaction(
        user_id=diner.id,
        menu_id=menu.id,
        operator_id=operator.id,  # extraído del JWT
        reservation_id=reservation_id,
        status="completed",
        payment_method=body.payment_method.value,
        amount=body.amount,
        notes=body.notes,
    )
    db.add(tx)

    # 7. Commit atómico — todo o nada
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        exc_str = str(exc).lower()
        if "served_lte_max" in exc_str:
            # Segunda línea de defensa: la restricción PostgreSQL bloqueó el overflow
            logger.warning(
                "transaction.concurrency_blocked",
                menu_id=str(body.menu_id),
                constraint="served_lte_max",
            )
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Sin porciones disponibles — conflicto de concurrencia detectado",
            ) from exc
        logger.error("transaction.integrity_error", error=str(exc), exc_info=True)
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Error de integridad al registrar la transacción. Operación revertida.",
        ) from exc

    await db.refresh(tx)
    logger.info(
        "transaction.created",
        tx_id=str(tx.id),
        diner_id=str(diner.id),
        diner_rut=diner.rut,
        operator_id=str(operator.id),
        menu_id=str(menu.id),
        payment_method=body.payment_method.value,
        amount=str(body.amount),
    )
    return tx


# ---------------------------------------------------------------------------
# GET /transactions  —  listado paginado con filtros (admin / operator)
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=TransactionPage,
    summary="Listar transacciones con filtros (admin / operator)",
)
async def list_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _op: _OperatorUser,
    user_id: UUID | None = Query(None, description="Filtrar por UUID del comensal"),
    menu_id: UUID | None = Query(None, description="Filtrar por UUID del menú"),
    operator_id: UUID | None = Query(None, description="Filtrar por UUID del operador"),
    payment_method: str | None = Query(None, description="Método de pago"),
    date_from: datetime | None = Query(None, description="Desde (ISO 8601)"),
    date_to: datetime | None = Query(None, description="Hasta (ISO 8601)"),
    page: int = Query(1, ge=1, description="Número de página"),
    per_page: int = Query(50, ge=1, le=200, description="Resultados por página"),
) -> TransactionPage:
    base = select(Transaction)

    if user_id:
        base = base.where(Transaction.user_id == user_id)
    if menu_id:
        base = base.where(Transaction.menu_id == menu_id)
    if operator_id:
        base = base.where(Transaction.operator_id == operator_id)
    if payment_method:
        base = base.where(Transaction.payment_method == payment_method)
    if date_from:
        base = base.where(Transaction.created_at >= date_from)
    if date_to:
        base = base.where(Transaction.created_at <= date_to)

    # Conteo sin LIMIT para la paginación
    total: int = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    stmt = (
        base.order_by(Transaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = list((await db.execute(stmt)).scalars().all())

    return TransactionPage(total=total, page=page, per_page=per_page, items=items)


# ---------------------------------------------------------------------------
# GET /transactions/mine  —  historial propio (cualquier usuario autenticado)
# IMPORTANTE: esta ruta debe registrarse ANTES de /{tx_id}
# ---------------------------------------------------------------------------


@router.get(
    "/mine",
    response_model=list[TransactionOut],
    summary="Mi historial de consumos",
)
async def my_transactions(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _AnyUser,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
) -> list[Transaction]:
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# GET /transactions/{tx_id}  —  detalle individual (admin / operator)
# ---------------------------------------------------------------------------


@router.get(
    "/{tx_id}",
    response_model=TransactionOut,
    summary="Detalle de transacción (admin / operator)",
)
async def get_transaction(
    tx_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _op: _OperatorUser,
) -> Transaction:
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id)
    )
    tx = result.scalar_one_or_none()
    if tx is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transacción no encontrada")
    return tx
