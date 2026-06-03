from datetime import date
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user, require_role
from app.database import get_db
from app.models.menu import Menu, MenuItem
from app.models.user import User
from app.schemas.menu import (
    MenuCreate,
    MenuItemCreate,
    MenuItemOut,
    MenuOut,
    MenuSummary,
    MenuUpdate,
)

router = APIRouter(prefix="/menus", tags=["menus"])
logger = structlog.get_logger()

# Aliases de dependencias para mantener los decoradores legibles
_AnyUser = Annotated[User, Depends(get_current_user)]
_StaffUser = Annotated[User, Depends(require_role("admin", "operator"))]
_AdminUser = Annotated[User, Depends(require_role("admin"))]


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------


def _assert_not_past(menu: Menu) -> None:
    """Bloquea modificaciones sobre menús con fecha de servicio ya vencida."""
    if menu.service_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El menú '{menu.name}' corresponde al {menu.service_date} "
                "y no puede modificarse porque su fecha de servicio ya pasó."
            ),
        )


async def _fetch_menu(
    db: AsyncSession,
    menu_id: UUID,
    *,
    with_items: bool = False,
) -> Menu:
    stmt = select(Menu).where(Menu.id == menu_id)
    if with_items:
        stmt = stmt.options(selectinload(Menu.items))
    result = await db.execute(stmt)
    menu = result.scalar_one_or_none()
    if menu is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menú {menu_id} no encontrado",
        )
    return menu


# ---------------------------------------------------------------------------
# GET /menus  —  listado (cualquier usuario autenticado)
# ---------------------------------------------------------------------------


@router.get("", response_model=list[MenuSummary], summary="Listar menús")
async def list_menus(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: _AnyUser,
    service_date: date | None = Query(None, description="Filtrar por fecha (YYYY-MM-DD)"),
    only_active: bool = Query(True, description="Mostrar solo menús activos"),
) -> list[Menu]:
    stmt = select(Menu)
    if service_date is not None:
        stmt = stmt.where(Menu.service_date == service_date)
    if only_active:
        stmt = stmt.where(Menu.is_active.is_(True))
    stmt = stmt.order_by(Menu.service_date.desc(), Menu.name)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# GET /menus/{menu_id}  —  detalle con ítems (cualquier usuario autenticado)
# ---------------------------------------------------------------------------


@router.get("/{menu_id}", response_model=MenuOut, summary="Detalle de menú")
async def get_menu(
    menu_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: _AnyUser,
) -> Menu:
    return await _fetch_menu(db, menu_id, with_items=True)


# ---------------------------------------------------------------------------
# POST /menus  —  creación transaccional (admin / operator)
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=MenuOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear menú con sus ítems",
)
async def create_menu(
    body: MenuCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _StaffUser,
) -> Menu:
    # Verificar duplicado: misma fecha + mismo nombre activo
    dup = await db.execute(
        select(Menu).where(
            Menu.service_date == body.service_date,
            Menu.name == body.name,
            Menu.is_active.is_(True),
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un menú activo llamado '{body.name}' para el {body.service_date}",
        )

    try:
        # flush() asigna el ID al menú sin hacer commit; si cualquier INSERT de
        # MenuItem falla, el rollback del bloque except elimina también el menú.
        menu = Menu(
            service_date=body.service_date,
            name=body.name,
            description=body.description,
            max_portions=body.max_portions,
            created_by=current_user.id,
        )
        db.add(menu)
        await db.flush()

        for item_data in body.items:
            db.add(
                MenuItem(
                    menu_id=menu.id,
                    name=item_data.name,
                    category=item_data.category,
                    calories=item_data.calories,
                    allergens=item_data.allergens,
                )
            )

        await db.commit()

    except IntegrityError as exc:
        await db.rollback()
        logger.error("menu.create_integrity_error", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Error de integridad al crear el menú. Operación revertida.",
        ) from exc

    except Exception as exc:
        await db.rollback()
        logger.error("menu.create_failed", error=str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error inesperado al crear el menú. Operación revertida.",
        ) from exc

    # Recarga con ítems para construir la respuesta
    result = await db.execute(
        select(Menu).where(Menu.id == menu.id).options(selectinload(Menu.items))
    )
    created = result.scalar_one()
    logger.info(
        "menu.created",
        menu_id=str(created.id),
        by=str(current_user.id),
        items=len(body.items),
    )
    return created


# ---------------------------------------------------------------------------
# PATCH /menus/{menu_id}  —  actualización parcial (admin / operator)
# ---------------------------------------------------------------------------


@router.patch("/{menu_id}", response_model=MenuOut, summary="Actualizar menú (parcial)")
async def update_menu(
    menu_id: UUID,
    body: MenuUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _StaffUser,
) -> Menu:
    menu = await _fetch_menu(db, menu_id, with_items=True)
    _assert_not_past(menu)

    # Evitar reducir max_portions por debajo de las porciones ya servidas
    if (
        body.max_portions is not None
        and body.max_portions < menu.served_portions
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"max_portions ({body.max_portions}) no puede ser menor "
                f"que las porciones ya servidas ({menu.served_portions})"
            ),
        )

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(menu, field, value)

    await db.commit()

    # Recarga con ítems para la respuesta
    result = await db.execute(
        select(Menu).where(Menu.id == menu_id).options(selectinload(Menu.items))
    )
    updated = result.scalar_one()
    logger.info("menu.updated", menu_id=str(menu_id), by=str(current_user.id))
    return updated


# ---------------------------------------------------------------------------
# DELETE /menus/{menu_id}  —  soft-delete (solo admin)
# ---------------------------------------------------------------------------


@router.delete(
    "/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactivar menú (soft delete, solo admin)",
)
async def delete_menu(
    menu_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _AdminUser,
) -> None:
    menu = await _fetch_menu(db, menu_id)
    _assert_not_past(menu)

    if menu.served_portions > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El menú ya registra {menu.served_portions} porción(es) servida(s) "
                "y no puede eliminarse. Desactívalo manualmente si es necesario."
            ),
        )

    menu.is_active = False
    await db.commit()
    logger.info("menu.deactivated", menu_id=str(menu_id), by=str(current_user.id))


# ---------------------------------------------------------------------------
# POST /menus/{menu_id}/items  —  agregar ítem a menú existente (admin / operator)
# ---------------------------------------------------------------------------


@router.post(
    "/{menu_id}/items",
    response_model=MenuOut,
    status_code=status.HTTP_201_CREATED,
    summary="Agregar ítem a un menú",
)
async def add_item(
    menu_id: UUID,
    body: MenuItemCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _StaffUser,
) -> Menu:
    menu = await _fetch_menu(db, menu_id, with_items=True)
    _assert_not_past(menu)

    if not menu.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pueden agregar ítems a un menú inactivo",
        )

    db.add(
        MenuItem(
            menu_id=menu.id,
            name=body.name,
            category=body.category,
            calories=body.calories,
            allergens=body.allergens,
        )
    )
    await db.commit()

    result = await db.execute(
        select(Menu).where(Menu.id == menu_id).options(selectinload(Menu.items))
    )
    return result.scalar_one()


# ---------------------------------------------------------------------------
# DELETE /menus/{menu_id}/items/{item_id}  —  eliminar ítem (admin / operator)
# ---------------------------------------------------------------------------


@router.delete(
    "/{menu_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar ítem de un menú",
)
async def delete_item(
    menu_id: UUID,
    item_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: _StaffUser,
) -> None:
    menu = await _fetch_menu(db, menu_id)
    _assert_not_past(menu)

    result = await db.execute(
        select(MenuItem).where(
            MenuItem.id == item_id,
            MenuItem.menu_id == menu_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ítem {item_id} no encontrado en el menú {menu_id}",
        )

    await db.delete(item)
    await db.commit()
    logger.info("menu_item.deleted", item_id=str(item_id), menu_id=str(menu_id))
