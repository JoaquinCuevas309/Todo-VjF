"""
Módulo de Reportes y Auditoría — solo accesible para rol 'admin'.

Todas las consultas usan agregaciones en PostgreSQL (func.sum, func.count,
group_by) para evitar cargar filas completas en memoria Python.

Protecciones contra DoS:
  - Rango máximo: 31 días por petición (validado en DateRangeParams).
  - Exportación CSV: limitada a UN solo día.
  - Todos los endpoints requieren JWT de admin.
"""

import asyncio
import csv
import io
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import cast, Date as SADate, Numeric, alias, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.database import get_db
from app.models.menu import Menu
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.report import (
    DailySummaryItem,
    DailySummaryReport,
    DashboardReport,
    DateRangeParams,
    MenuConsumptionItem,
    MenuConsumptionReport,
    OperatorSummaryItem,
    OperatorSummaryReport,
    PaymentBreakdownItem,
    PaymentBreakdownReport,
)

router = APIRouter(prefix="/reports", tags=["reports"])
logger = structlog.get_logger()

_AdminUser = Depends(require_role("admin"))

# Alias de tabla para el JOIN doble de usuarios (comensal y operador)
_OperatorUser = alias(User, name="operator_user")


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------


def _day_bounds(d: date) -> tuple[datetime, datetime]:
    """Convierte una fecha en inicio/fin del día en UTC."""
    start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=UTC)
    end = datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=UTC)
    return start, end


def _range_bounds(params: DateRangeParams) -> tuple[datetime, datetime]:
    start = datetime(
        params.start_date.year, params.start_date.month, params.start_date.day,
        0, 0, 0, tzinfo=UTC,
    )
    end = datetime(
        params.end_date.year, params.end_date.month, params.end_date.day,
        23, 59, 59, 999999, tzinfo=UTC,
    )
    return start, end


def _base_tx_filter(start_dt: datetime, end_dt: datetime):
    """Predicados comunes para transacciones completadas en el rango."""
    return [
        Transaction.created_at >= start_dt,
        Transaction.created_at <= end_dt,
        Transaction.status == "completed",
    ]


# ---------------------------------------------------------------------------
# GET /reports/daily-summary
# ---------------------------------------------------------------------------


@router.get(
    "/daily-summary",
    response_model=DailySummaryReport,
    summary="Resumen diario de consumos",
    dependencies=[_AdminUser],
)
async def daily_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    params: Annotated[DateRangeParams, Depends(DateRangeParams.as_dependency())],
) -> DailySummaryReport:
    start_dt, end_dt = _range_bounds(params)

    day_col = cast(Transaction.created_at, SADate).label("day")

    stmt = (
        select(
            day_col,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0).label("total_revenue"),
            func.count(distinct(Transaction.user_id)).label("unique_diners"),
        )
        .where(*_base_tx_filter(start_dt, end_dt))
        .group_by(day_col)
        .order_by(day_col)
    )

    rows = (await db.execute(stmt)).all()

    items = [
        DailySummaryItem(
            day=r.day,
            transaction_count=r.transaction_count,
            total_revenue=Decimal(str(r.total_revenue)),
            unique_diners=r.unique_diners,
        )
        for r in rows
    ]

    total_tx = sum(i.transaction_count for i in items)
    total_rev = sum(i.total_revenue for i in items)
    total_diners = (
        await db.execute(
            select(func.count(distinct(Transaction.user_id)))
            .where(*_base_tx_filter(start_dt, end_dt))
        )
    ).scalar_one()

    logger.info(
        "report.daily_summary",
        start=str(params.start_date),
        end=str(params.end_date),
        rows=len(items),
    )
    return DailySummaryReport(
        start_date=params.start_date,
        end_date=params.end_date,
        total_transactions=total_tx,
        total_revenue=total_rev,
        total_unique_diners=total_diners,
        rows=items,
    )


# ---------------------------------------------------------------------------
# GET /reports/by-menu
# ---------------------------------------------------------------------------


@router.get(
    "/by-menu",
    response_model=MenuConsumptionReport,
    summary="Consumo y ocupación por menú",
    dependencies=[_AdminUser],
)
async def by_menu(
    db: Annotated[AsyncSession, Depends(get_db)],
    params: Annotated[DateRangeParams, Depends(DateRangeParams.as_dependency())],
) -> MenuConsumptionReport:
    start_dt, end_dt = _range_bounds(params)

    # LEFT JOIN para incluir menús sin transacciones (porciones = 0)
    stmt = (
        select(
            Menu.id.label("menu_id"),
            Menu.name.label("menu_name"),
            Menu.service_date,
            Menu.max_portions,
            Menu.served_portions,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(
                func.sum(cast(Transaction.amount, Numeric(10, 2))), 0
            ).label("revenue"),
        )
        .outerjoin(
            Transaction,
            (Transaction.menu_id == Menu.id) & (Transaction.status == "completed"),
        )
        .where(
            Menu.service_date >= params.start_date,
            Menu.service_date <= params.end_date,
        )
        .group_by(
            Menu.id,
            Menu.name,
            Menu.service_date,
            Menu.max_portions,
            Menu.served_portions,
        )
        .order_by(Menu.service_date.desc(), Menu.name)
    )

    rows = (await db.execute(stmt)).all()

    items = [
        MenuConsumptionItem(
            menu_id=r.menu_id,
            menu_name=r.menu_name,
            service_date=r.service_date,
            max_portions=r.max_portions,
            served_portions=r.served_portions,
            transaction_count=r.transaction_count,
            revenue=Decimal(str(r.revenue)),
        )
        for r in rows
    ]

    return MenuConsumptionReport(
        start_date=params.start_date,
        end_date=params.end_date,
        rows=items,
    )


# ---------------------------------------------------------------------------
# GET /reports/by-payment-method
# ---------------------------------------------------------------------------


@router.get(
    "/by-payment-method",
    response_model=PaymentBreakdownReport,
    summary="Ingresos agrupados por método de pago",
    dependencies=[_AdminUser],
)
async def by_payment_method(
    db: Annotated[AsyncSession, Depends(get_db)],
    params: Annotated[DateRangeParams, Depends(DateRangeParams.as_dependency())],
) -> PaymentBreakdownReport:
    start_dt, end_dt = _range_bounds(params)
    where = _base_tx_filter(start_dt, end_dt)

    # Total global del período (subquery escalar)
    grand_total_sq = (
        select(func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0))
        .where(*where)
        .scalar_subquery()
    )

    stmt = (
        select(
            Transaction.payment_method,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(
                func.sum(cast(Transaction.amount, Numeric(10, 2))), 0
            ).label("total_amount"),
            # Porcentaje calculado directamente en PostgreSQL
            func.round(
                func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0)
                / func.nullif(grand_total_sq, 0)
                * 100,
                2,
            ).label("percentage"),
        )
        .where(*where)
        .group_by(Transaction.payment_method)
        .order_by(func.sum(cast(Transaction.amount, Numeric(10, 2))).desc())
    )

    rows = (await db.execute(stmt)).all()

    grand_total_val: Decimal = (
        await db.execute(
            select(func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0))
            .where(*where)
        )
    ).scalar_one()

    items = [
        PaymentBreakdownItem(
            payment_method=r.payment_method,
            transaction_count=r.transaction_count,
            total_amount=Decimal(str(r.total_amount)),
            percentage=float(r.percentage or 0),
        )
        for r in rows
    ]

    return PaymentBreakdownReport(
        start_date=params.start_date,
        end_date=params.end_date,
        grand_total=Decimal(str(grand_total_val)),
        rows=items,
    )


# ---------------------------------------------------------------------------
# GET /reports/by-operator
# ---------------------------------------------------------------------------


@router.get(
    "/by-operator",
    response_model=OperatorSummaryReport,
    summary="Transacciones y montos por operador",
    dependencies=[_AdminUser],
)
async def by_operator(
    db: Annotated[AsyncSession, Depends(get_db)],
    params: Annotated[DateRangeParams, Depends(DateRangeParams.as_dependency())],
) -> OperatorSummaryReport:
    start_dt, end_dt = _range_bounds(params)

    # Alias explícito para el JOIN de operadores (evita ambigüedad con el JOIN de comensales)
    op = alias(User.__table__, name="op")

    stmt = (
        select(
            Transaction.operator_id,
            op.c.full_name.label("operator_name"),
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(
                func.sum(cast(Transaction.amount, Numeric(10, 2))), 0
            ).label("total_amount"),
        )
        .join(op, op.c.id == Transaction.operator_id)
        .where(*_base_tx_filter(start_dt, end_dt))
        .group_by(Transaction.operator_id, op.c.full_name)
        .order_by(func.count(Transaction.id).desc())
    )

    rows = (await db.execute(stmt)).all()

    items = [
        OperatorSummaryItem(
            operator_id=r.operator_id,
            operator_name=r.operator_name,
            transaction_count=r.transaction_count,
            total_amount=Decimal(str(r.total_amount)),
        )
        for r in rows
    ]

    return OperatorSummaryReport(
        start_date=params.start_date,
        end_date=params.end_date,
        rows=items,
    )


# ---------------------------------------------------------------------------
# GET /reports/dashboard  —  vista consolidada (ejecuta queries en paralelo)
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard",
    response_model=DashboardReport,
    summary="Dashboard consolidado — todas las métricas",
    dependencies=[_AdminUser],
)
async def dashboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    params: Annotated[DateRangeParams, Depends(DateRangeParams.as_dependency())],
) -> DashboardReport:
    start_dt, end_dt = _range_bounds(params)
    where = _base_tx_filter(start_dt, end_dt)
    day_col = cast(Transaction.created_at, SADate).label("day")

    # Las cuatro consultas son independientes — se lanzan en paralelo
    daily_q = db.execute(
        select(
            day_col,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0).label("total_revenue"),
            func.count(distinct(Transaction.user_id)).label("unique_diners"),
        )
        .where(*where)
        .group_by(day_col)
        .order_by(day_col)
    )

    payment_q = db.execute(
        select(
            Transaction.payment_method,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0).label("total_amount"),
        )
        .where(*where)
        .group_by(Transaction.payment_method)
        .order_by(func.sum(cast(Transaction.amount, Numeric(10, 2))).desc())
    )

    op_alias = alias(User.__table__, name="op_dash")
    operator_q = db.execute(
        select(
            Transaction.operator_id,
            op_alias.c.full_name.label("operator_name"),
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0).label("total_amount"),
        )
        .join(op_alias, op_alias.c.id == Transaction.operator_id)
        .where(*where)
        .group_by(Transaction.operator_id, op_alias.c.full_name)
        .order_by(func.count(Transaction.id).desc())
    )

    top_menus_q = db.execute(
        select(
            Menu.id.label("menu_id"),
            Menu.name.label("menu_name"),
            Menu.service_date,
            Menu.max_portions,
            Menu.served_portions,
            func.count(Transaction.id).label("transaction_count"),
            func.coalesce(func.sum(cast(Transaction.amount, Numeric(10, 2))), 0).label("revenue"),
        )
        .outerjoin(
            Transaction,
            (Transaction.menu_id == Menu.id) & (Transaction.status == "completed"),
        )
        .where(Menu.service_date >= params.start_date, Menu.service_date <= params.end_date)
        .group_by(Menu.id, Menu.name, Menu.service_date, Menu.max_portions, Menu.served_portions)
        .order_by(func.count(Transaction.id).desc())
        .limit(10)
    )

    daily_res, payment_res, op_res, menus_res = await asyncio.gather(
        daily_q, payment_q, operator_q, top_menus_q
    )

    daily_rows = daily_res.all()
    payment_rows = payment_res.all()
    op_rows = op_res.all()
    menu_rows = menus_res.all()

    total_tx = sum(r.transaction_count for r in daily_rows)
    total_rev = sum(Decimal(str(r.total_revenue)) for r in daily_rows)
    grand_total = total_rev or Decimal("1")  # evitar división por cero

    daily_items = [
        DailySummaryItem(
            day=r.day,
            transaction_count=r.transaction_count,
            total_revenue=Decimal(str(r.total_revenue)),
            unique_diners=r.unique_diners,
        )
        for r in daily_rows
    ]

    payment_items = [
        PaymentBreakdownItem(
            payment_method=r.payment_method,
            transaction_count=r.transaction_count,
            total_amount=Decimal(str(r.total_amount)),
            percentage=round(float(Decimal(str(r.total_amount)) / grand_total * 100), 2),
        )
        for r in payment_rows
    ]

    op_items = [
        OperatorSummaryItem(
            operator_id=r.operator_id,
            operator_name=r.operator_name,
            transaction_count=r.transaction_count,
            total_amount=Decimal(str(r.total_amount)),
        )
        for r in op_rows
    ]

    menu_items = [
        MenuConsumptionItem(
            menu_id=r.menu_id,
            menu_name=r.menu_name,
            service_date=r.service_date,
            max_portions=r.max_portions,
            served_portions=r.served_portions,
            transaction_count=r.transaction_count,
            revenue=Decimal(str(r.revenue)),
        )
        for r in menu_rows
    ]

    total_unique_diners = sum(r.unique_diners for r in daily_rows)

    logger.info(
        "report.dashboard",
        start=str(params.start_date),
        end=str(params.end_date),
        total_tx=total_tx,
        total_rev=str(total_rev),
    )

    return DashboardReport(
        generated_at=datetime.now(UTC),
        start_date=params.start_date,
        end_date=params.end_date,
        total_transactions=total_tx,
        total_revenue=total_rev,
        total_unique_diners=total_unique_diners,
        daily=daily_items,
        by_payment_method=payment_items,
        top_menus=menu_items,
        by_operator=op_items,
    )


# ---------------------------------------------------------------------------
# GET /reports/export/csv  —  exportación diaria (un solo día)
# ---------------------------------------------------------------------------


@router.get(
    "/export/csv",
    summary="Exportar transacciones del día como CSV",
    response_class=StreamingResponse,
    dependencies=[_AdminUser],
    responses={
        200: {
            "content": {"text/csv": {}},
            "description": "Archivo CSV de transacciones",
        }
    },
)
async def export_csv(
    db: Annotated[AsyncSession, Depends(get_db)],
    export_date: date = Query(..., description="Fecha a exportar (YYYY-MM-DD)"),
) -> StreamingResponse:
    start_dt, end_dt = _day_bounds(export_date)

    # Alias para evitar ambigüedad en el doble JOIN a users
    diner_tbl = alias(User.__table__, name="diner")
    op_tbl = alias(User.__table__, name="op_csv")

    stmt = (
        select(
            Transaction.id.label("transaction_id"),
            diner_tbl.c.rut.label("diner_rut"),
            diner_tbl.c.full_name.label("diner_name"),
            Menu.name.label("menu_name"),
            Menu.service_date,
            Transaction.payment_method,
            cast(Transaction.amount, Numeric(10, 2)).label("amount"),
            Transaction.status,
            Transaction.notes,
            Transaction.created_at,
            op_tbl.c.full_name.label("operator_name"),
        )
        .join(diner_tbl, diner_tbl.c.id == Transaction.user_id)
        .join(op_tbl, op_tbl.c.id == Transaction.operator_id)
        .outerjoin(Menu, Menu.id == Transaction.menu_id)
        .where(
            Transaction.created_at >= start_dt,
            Transaction.created_at <= end_dt,
        )
        .order_by(Transaction.created_at)
    )

    rows = (await db.execute(stmt)).all()

    # Construye el CSV en memoria — seguro para volúmenes de un día de casino
    buffer = io.StringIO()
    # BOM UTF-8 para compatibilidad con Excel en español
    buffer.write("﻿")

    writer = csv.writer(buffer, delimiter=";", quoting=csv.QUOTE_ALL)
    writer.writerow([
        "ID Transacción",
        "RUT Comensal",
        "Nombre Comensal",
        "Menú",
        "Fecha Servicio",
        "Método Pago",
        "Monto",
        "Estado",
        "Notas",
        "Fecha y Hora",
        "Operador",
    ])

    for r in rows:
        writer.writerow([
            str(r.transaction_id),
            r.diner_rut,
            r.diner_name,
            r.menu_name or "",
            str(r.service_date) if r.service_date else "",
            r.payment_method,
            str(r.amount),
            r.status,
            r.notes or "",
            r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            r.operator_name,
        ])

    csv_bytes = buffer.getvalue().encode("utf-8")
    filename = f"transacciones_{export_date.isoformat()}.csv"

    logger.info(
        "report.csv_exported",
        export_date=str(export_date),
        row_count=len(rows),
    )

    return StreamingResponse(
        content=iter([csv_bytes]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(csv_bytes)),
            "X-Row-Count": str(len(rows)),
        },
    )
