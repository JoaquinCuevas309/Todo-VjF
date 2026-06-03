"""TDD: validación de schemas de autenticación sin base de datos."""
import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate, UserLogin


class TestUserLoginSchema:
    def test_valid_rut(self):
        u = UserLogin(identifier="12345678-9", password="secret")
        assert u.identifier == "12345678-9"

    def test_valid_rut_uppercase_k(self):
        u = UserLogin(identifier="12345678-K", password="secret")
        assert u.identifier == "12345678-K"

    def test_valid_email(self):
        u = UserLogin(identifier="user@example.com", password="secret")
        assert u.identifier == "user@example.com"

    def test_invalid_identifier_rejects(self):
        with pytest.raises(ValidationError):
            UserLogin(identifier="'; DROP TABLE users;--", password="x")

    def test_too_long_identifier_rejects(self):
        with pytest.raises(ValidationError):
            UserLogin(identifier="a" * 300, password="x")

    def test_empty_password_rejects(self):
        with pytest.raises(ValidationError):
            UserLogin(identifier="12345678-9", password="   ")


class TestUserCreateSchema:
    _STRONG_PW = "Segura123!"

    def test_valid_user(self):
        u = UserCreate(
            rut="12345678-9",
            full_name="Juan Pérez",
            password=self._STRONG_PW,
        )
        assert u.rut == "12345678-9"
        assert u.role.value == "diner"

    def test_rut_normalized_to_uppercase(self):
        u = UserCreate(rut="12345678-k", full_name="Ana López", password=self._STRONG_PW)
        assert u.rut == "12345678-K"

    def test_invalid_rut_rejects(self):
        with pytest.raises(ValidationError):
            UserCreate(rut="invalid-rut", full_name="Test", password=self._STRONG_PW)

    def test_weak_password_rejects(self):
        with pytest.raises(ValidationError, match="Contraseña débil"):
            UserCreate(rut="12345678-9", full_name="Test User", password="weak")

    def test_sql_injection_in_name_rejects(self):
        with pytest.raises(ValidationError):
            UserCreate(
                rut="12345678-9",
                full_name="'; DROP TABLE users; --",
                password=self._STRONG_PW,
            )

    def test_name_too_short_rejects(self):
        with pytest.raises(ValidationError):
            UserCreate(rut="12345678-9", full_name="AB", password=self._STRONG_PW)

    def test_invalid_role_rejects(self):
        with pytest.raises(ValidationError):
            UserCreate(
                rut="12345678-9",
                full_name="Test User",
                password=self._STRONG_PW,
                role="superadmin",
            )
