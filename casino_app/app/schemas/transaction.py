import enum
import re
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

_RUT_RE = re.compile(r"^\d{7,8}-[\dkK]$")
_QR_RE = re.compile(r"^[a-zA-Z0-9\-_]+$")


# ---------------------------------------------------------------------------
# Enums — espejo exacto de los tipos PostgreSQL del DDL
# ---------------------------------------------------------------------------


class PaymentMethod(str, enum.Enum):
    balance = "balance"
    payroll_discount = "payroll_discount"
    cash = "cash"
    free = "free"


class TxStatus(str, enum.Enum):
    completed = "completed"
    reversed = "reversed"
    pending = "pending"


# ---------------------------------------------------------------------------
# Schema de creación
# ---------------------------------------------------------------------------


class TransactionCreate(BaseModel):
    """
    El operador identifica al comensal por exactamente uno de:
      - user_id   (UUID, obtenido del QR que contiene el UUID del usuario)
      - user_rut  (RUT escrito/escaneado manualmente)
      - qr_token  (token de la reserva pre-generada)

    operator_id se extrae del JWT en el endpoint — nunca viene del cliente.
    """

    user_id: UUID | None = None
    user_rut: str | None = None
    qr_token: str | None = None

    menu_id: UUID
    payment_method: PaymentMethod
    amount: Decimal = Field(ge=Decimal("0"), decimal_places=2, max_digits=10)
    notes: str | None = None

    # ── Validadores de campo ──────────────────────────────────────────────

    @field_validator("user_rut")
    @classmethod
    def validate_rut(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().upper()
        if not _RUT_RE.match(v):
            raise ValueError("RUT inválido. Formato esperado: 12345678-9 o 12345678-K")
        return v

    @field_validator("qr_token")
    @classmethod
    def validate_qr_token(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v or len(v) > 64:
            raise ValueError("qr_token inválido: largo incorrecto")
        if not _QR_RE.match(v):
            raise ValueError("qr_token contiene caracteres no permitidos")
        return v

    @field_validator("notes")
    @classmethod
    def sanitize_notes(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 500:
            raise ValueError("Las notas no pueden superar los 500 caracteres")
        return v

    # ── Validador de modelo — exactamente un identificador ────────────────

    @model_validator(mode="after")
    def exactly_one_identifier(self) -> "TransactionCreate":
        provided = sum(
            1 for x in [self.user_id, self.user_rut, self.qr_token] if x is not None
        )
        if provided == 0:
            raise ValueError(
                "Debe proveer exactamente uno de: user_id, user_rut, qr_token"
            )
        if provided > 1:
            raise ValueError(
                "Solo puede proveer uno de: user_id, user_rut, qr_token"
            )
        return self

    @model_validator(mode="after")
    def free_method_requires_zero(self) -> "TransactionCreate":
        """Si el método de pago es 'free', el monto debe ser cero."""
        if self.payment_method == PaymentMethod.free and self.amount != Decimal("0"):
            raise ValueError(
                "El monto debe ser 0.00 cuando el método de pago es 'free'"
            )
        return self


# ---------------------------------------------------------------------------
# Schemas de salida
# ---------------------------------------------------------------------------


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    menu_id: UUID | None
    operator_id: UUID
    reservation_id: UUID | None
    status: str
    payment_method: str
    amount: Decimal
    notes: str | None
    created_at: datetime


class TransactionPage(BaseModel):
    """Respuesta paginada para listados de auditoría."""

    total: int
    page: int
    per_page: int
    items: list[TransactionOut]
