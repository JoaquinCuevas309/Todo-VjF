"""TDD: validación de schemas de menú sin base de datos."""
from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from app.schemas.menu import MenuCreate, MenuItemCreate, MenuUpdate


class TestMenuItemCreate:
    def test_valid_item(self):
        item = MenuItemCreate(name="Pollo al horno", category="fondo", calories=450)
        assert item.name == "Pollo al horno"
        assert item.category == "fondo"

    def test_category_normalized_to_lowercase(self):
        item = MenuItemCreate(name="Ensalada", category="ENTRADA")
        assert item.category == "entrada"

    def test_invalid_category_rejects(self):
        with pytest.raises(ValidationError, match="Categoría debe ser"):
            MenuItemCreate(name="Algo", category="snack")

    def test_negative_calories_rejects(self):
        with pytest.raises(ValidationError, match="positivo"):
            MenuItemCreate(name="Algo", calories=-10)

    def test_zero_calories_rejects(self):
        with pytest.raises(ValidationError, match="positivo"):
            MenuItemCreate(name="Algo", calories=0)

    def test_invalid_allergen_rejects(self):
        with pytest.raises(ValidationError, match="Alérgenos no reconocidos"):
            MenuItemCreate(name="Algo", allergens=["kryptonita"])

    def test_allergens_normalized_to_lowercase(self):
        item = MenuItemCreate(name="Algo", allergens=["Gluten", "LACTOSA"])
        assert item.allergens == ["gluten", "lactosa"]

    def test_injection_in_name_rejects(self):
        with pytest.raises(ValidationError):
            MenuItemCreate(name="<script>alert(1)</script>")


class TestMenuCreate:
    _tomorrow = date.today() + timedelta(days=1)

    def test_valid_menu(self):
        menu = MenuCreate(
            service_date=self._tomorrow,
            name="Almuerzo Lunes",
            max_portions=100,
        )
        assert menu.max_portions == 100

    def test_past_date_rejects(self):
        with pytest.raises(ValidationError, match="fecha pasada"):
            MenuCreate(
                service_date=date(2020, 1, 1),
                name="Antiguo",
                max_portions=50,
            )

    def test_zero_portions_rejects(self):
        with pytest.raises(ValidationError, match="mayor a cero"):
            MenuCreate(service_date=self._tomorrow, name="Test", max_portions=0)

    def test_negative_portions_rejects(self):
        with pytest.raises(ValidationError, match="mayor a cero"):
            MenuCreate(service_date=self._tomorrow, name="Test", max_portions=-5)

    def test_over_limit_portions_rejects(self):
        with pytest.raises(ValidationError, match="10 000"):
            MenuCreate(service_date=self._tomorrow, name="Test", max_portions=99999)

    def test_description_too_long_rejects(self):
        with pytest.raises(ValidationError, match="1000"):
            MenuCreate(
                service_date=self._tomorrow,
                name="Test",
                max_portions=50,
                description="x" * 1001,
            )


class TestMenuUpdate:
    def test_empty_update_rejects(self):
        with pytest.raises(ValidationError, match="al menos un campo"):
            MenuUpdate()

    def test_valid_partial_update(self):
        upd = MenuUpdate(max_portions=200)
        assert upd.max_portions == 200
        assert upd.name is None

    def test_zero_max_portions_rejects(self):
        with pytest.raises(ValidationError, match="mayor a cero"):
            MenuUpdate(max_portions=0)
