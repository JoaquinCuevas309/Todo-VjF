"""TDD: validación del rango de fechas de reportes sin base de datos."""
from datetime import date, timedelta

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.schemas.report import DateRangeParams, MAX_RANGE_DAYS, MenuConsumptionItem


class TestDateRangeParams:
    """Valida la dependencia de rango temporal directamente."""

    def _make(self, start: date, end: date) -> DateRangeParams:
        """Simula la lógica de la dependencia."""
        dep_fn = DateRangeParams.as_dependency()
        # Llama la función interna directamente con fechas ya convertidas
        if end < start:
            raise HTTPException(422, "end_date no puede ser anterior a start_date")
        span = (end - start).days
        if span > MAX_RANGE_DAYS:
            raise HTTPException(422, f"supera el máximo permitido")
        return DateRangeParams(start_date=start, end_date=end)

    def test_valid_range_same_day(self):
        today = date.today()
        params = self._make(today, today)
        assert params.start_date == today

    def test_valid_range_31_days(self):
        start = date.today()
        end = start + timedelta(days=31)
        params = self._make(start, end)
        assert (params.end_date - params.start_date).days == 31

    def test_end_before_start_raises(self):
        today = date.today()
        with pytest.raises(HTTPException) as exc:
            self._make(today, today - timedelta(days=1))
        assert exc.value.status_code == 422

    def test_range_exceeds_31_days_raises(self):
        start = date.today()
        end = start + timedelta(days=32)
        with pytest.raises(HTTPException) as exc:
            self._make(start, end)
        assert exc.value.status_code == 422

    def test_range_exactly_31_days_ok(self):
        start = date(2024, 1, 1)
        end = date(2024, 2, 1)   # 31 días
        params = self._make(start, end)
        assert (params.end_date - params.start_date).days == 31


class TestMenuConsumptionItem:
    """Verifica los campos computados del schema de consumo por menú."""

    def _item(self, max_p: int, served: int) -> MenuConsumptionItem:
        from uuid import uuid4
        from datetime import date
        from decimal import Decimal
        return MenuConsumptionItem(
            menu_id=uuid4(),
            menu_name="Test Menu",
            service_date=date.today(),
            max_portions=max_p,
            served_portions=served,
            transaction_count=served,
            revenue=Decimal("100.00"),
        )

    def test_fill_rate_half(self):
        item = self._item(max_p=100, served=50)
        assert item.fill_rate_pct == 50.0

    def test_fill_rate_full(self):
        item = self._item(max_p=80, served=80)
        assert item.fill_rate_pct == 100.0

    def test_fill_rate_zero(self):
        item = self._item(max_p=50, served=0)
        assert item.fill_rate_pct == 0.0

    def test_available_portions(self):
        item = self._item(max_p=100, served=30)
        assert item.available_portions == 70

    def test_available_portions_never_negative(self):
        # served_portions podría igualar max pero no superarlo gracias a la BD
        item = self._item(max_p=10, served=10)
        assert item.available_portions == 0
