from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, computed_field, model_validator


# ---------------------------------------------------------------------------
# Parámetros de rango de fechas — validados como dependencia en los endpoints
# ---------------------------------------------------------------------------

MAX_RANGE_DAYS = 31


class DateRangeParams:
    """
    Dependencia FastAPI para validar parámetros de rango temporal.
    No es un schema Pydantic — se inyecta con Depends().
    """

    def __init__(self, start_date: date, end_date: date) -> None:
        self.start_date = start_date
        self.end_date = end_date

    @classmethod
    def as_dependency(cls):
        from fastapi import HTTPException, Query

        def _dep(
            start_date: date = Query(..., description="Fecha de inicio (YYYY-MM-DD)"),
            end_date: date = Query(..., description="Fecha de fin (YYYY-MM-DD)"),
        ) -> "DateRangeParams":
            if end_date < start_date:
                raise HTTPException(
                    422, "end_date no puede ser anterior a start_date"
                )
            span = (end_date - start_date).days
            if span > MAX_RANGE_DAYS:
                raise HTTPException(
                    422,
                    f"El rango solicitado ({span} días) supera el máximo permitido "
                    f"({MAX_RANGE_DAYS} días). Divide la consulta en intervalos más cortos.",
                )
            return cls(start_date=start_date, end_date=end_date)

        return _dep


# ---------------------------------------------------------------------------
# Reportes de resumen diario
# ---------------------------------------------------------------------------


class DailySummaryItem(BaseModel):
    """Una fila por día dentro del rango solicitado."""

    day: date
    transaction_count: int
    total_revenue: Decimal
    unique_diners: int


class DailySummaryReport(BaseModel):
    start_date: date
    end_date: date
    total_transactions: int
    total_revenue: Decimal
    total_unique_diners: int
    rows: list[DailySummaryItem]


# ---------------------------------------------------------------------------
# Reporte de consumo por menú
# ---------------------------------------------------------------------------


class MenuConsumptionItem(BaseModel):
    menu_id: UUID
    menu_name: str
    service_date: date
    max_portions: int
    served_portions: int
    transaction_count: int
    revenue: Decimal

    @computed_field  # type: ignore[misc]
    @property
    def fill_rate_pct(self) -> float:
        """Porcentaje de ocupación: porciones servidas / máximo."""
        if self.max_portions == 0:
            return 0.0
        return round(self.served_portions / self.max_portions * 100, 2)

    @computed_field  # type: ignore[misc]
    @property
    def available_portions(self) -> int:
        return max(0, self.max_portions - self.served_portions)


class MenuConsumptionReport(BaseModel):
    start_date: date
    end_date: date
    rows: list[MenuConsumptionItem]


# ---------------------------------------------------------------------------
# Reporte por método de pago
# ---------------------------------------------------------------------------


class PaymentBreakdownItem(BaseModel):
    payment_method: str
    transaction_count: int
    total_amount: Decimal
    percentage: float  # % sobre el total del período


class PaymentBreakdownReport(BaseModel):
    start_date: date
    end_date: date
    grand_total: Decimal
    rows: list[PaymentBreakdownItem]


# ---------------------------------------------------------------------------
# Reporte por operador
# ---------------------------------------------------------------------------


class OperatorSummaryItem(BaseModel):
    operator_id: UUID
    operator_name: str
    transaction_count: int
    total_amount: Decimal


class OperatorSummaryReport(BaseModel):
    start_date: date
    end_date: date
    rows: list[OperatorSummaryItem]


# ---------------------------------------------------------------------------
# Dashboard — vista consolidada (llama a todas las consultas)
# ---------------------------------------------------------------------------


class DashboardReport(BaseModel):
    generated_at: datetime
    start_date: date
    end_date: date
    total_transactions: int
    total_revenue: Decimal
    total_unique_diners: int
    daily: list[DailySummaryItem]
    by_payment_method: list[PaymentBreakdownItem]
    top_menus: list[MenuConsumptionItem]
    by_operator: list[OperatorSummaryItem]
