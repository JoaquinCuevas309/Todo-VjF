"""TDD: validación de schemas de transacciones sin base de datos."""
from decimal import Decimal
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.transaction import PaymentMethod, TransactionCreate


_MENU_ID = uuid4()
_USER_ID = uuid4()


class TestTransactionCreate:
    def test_valid_by_user_id(self):
        tx = TransactionCreate(
            user_id=_USER_ID,
            menu_id=_MENU_ID,
            payment_method=PaymentMethod.cash,
            amount=Decimal("3500.00"),
        )
        assert tx.user_id == _USER_ID
        assert tx.operator_id_from_client is None  # no existe este campo

    def test_valid_by_rut(self):
        tx = TransactionCreate(
            user_rut="12345678-9",
            menu_id=_MENU_ID,
            payment_method=PaymentMethod.balance,
            amount=Decimal("0.00"),
        )
        assert tx.user_rut == "12345678-9"

    def test_rut_normalized_to_uppercase(self):
        tx = TransactionCreate(
            user_rut="12345678-k",
            menu_id=_MENU_ID,
            payment_method=PaymentMethod.cash,
            amount=Decimal("100"),
        )
        assert tx.user_rut == "12345678-K"

    def test_valid_by_qr_token(self):
        tx = TransactionCreate(
            qr_token="abc123-XYZ_token",
            menu_id=_MENU_ID,
            payment_method=PaymentMethod.payroll_discount,
            amount=Decimal("2800"),
        )
        assert tx.qr_token == "abc123-XYZ_token"

    def test_no_identifier_rejects(self):
        with pytest.raises(ValidationError, match="exactamente uno"):
            TransactionCreate(
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
            )

    def test_multiple_identifiers_rejects(self):
        with pytest.raises(ValidationError, match="Solo puede proveer uno"):
            TransactionCreate(
                user_id=_USER_ID,
                user_rut="12345678-9",
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
            )

    def test_negative_amount_rejects(self):
        with pytest.raises(ValidationError):
            TransactionCreate(
                user_id=_USER_ID,
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("-1"),
            )

    def test_free_method_nonzero_amount_rejects(self):
        with pytest.raises(ValidationError, match="monto debe ser 0.00"):
            TransactionCreate(
                user_id=_USER_ID,
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.free,
                amount=Decimal("500"),
            )

    def test_free_method_zero_amount_ok(self):
        tx = TransactionCreate(
            user_id=_USER_ID,
            menu_id=_MENU_ID,
            payment_method=PaymentMethod.free,
            amount=Decimal("0"),
        )
        assert tx.payment_method == PaymentMethod.free

    def test_invalid_rut_rejects(self):
        with pytest.raises(ValidationError, match="RUT inválido"):
            TransactionCreate(
                user_rut="'; DROP TABLE users;--",
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
            )

    def test_qr_token_with_invalid_chars_rejects(self):
        with pytest.raises(ValidationError, match="caracteres no permitidos"):
            TransactionCreate(
                qr_token="<script>alert(1)</script>",
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
            )

    def test_qr_token_too_long_rejects(self):
        with pytest.raises(ValidationError, match="largo incorrecto"):
            TransactionCreate(
                qr_token="a" * 65,
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
            )

    def test_notes_too_long_rejects(self):
        with pytest.raises(ValidationError, match="500"):
            TransactionCreate(
                user_id=_USER_ID,
                menu_id=_MENU_ID,
                payment_method=PaymentMethod.cash,
                amount=Decimal("100"),
                notes="x" * 501,
            )

    def test_invalid_payment_method_rejects(self):
        with pytest.raises(ValidationError):
            TransactionCreate(
                user_id=_USER_ID,
                menu_id=_MENU_ID,
                payment_method="credito",  # no existe en el enum
                amount=Decimal("100"),
            )
