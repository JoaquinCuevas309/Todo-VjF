import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TxStatus(str, enum.Enum):
    completed = "completed"
    reversed = "reversed"
    pending = "pending"


class PaymentMethod(str, enum.Enum):
    balance = "balance"
    payroll_discount = "payroll_discount"
    cash = "cash"
    free = "free"


class ReservationStatus(str, enum.Enum):
    active = "active"
    consumed = "consumed"
    cancelled = "cancelled"
    expired = "expired"


class Transaction(Base):
    """
    Inmutable por diseño: sin updated_at.
    A nivel de BD: REVOKE UPDATE, DELETE aplicado al usuario de la app.
    A nivel de API: solo existen endpoints POST y GET.
    """

    __tablename__ = "transactions"
    __table_args__ = {"schema": "casino"}

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=False, index=True
    )
    menu_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("casino.menus.id")
    )
    operator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=False, index=True
    )
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("casino.reservations.id", ondelete="RESTRICT")
    )
    status: Mapped[TxStatus] = mapped_column(
        SAEnum(TxStatus, name="tx_status", schema="casino", create_type=False),
        nullable=False,
        default=TxStatus.completed,
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method", schema="casino", create_type=False),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relaciones de solo lectura — lazy="raise" obliga a carga explícita (previene N+1)
    diner: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[user_id],
        lazy="raise",
    )
    operator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User",
        foreign_keys=[operator_id],
        lazy="raise",
    )
    menu_ref: Mapped["Menu | None"] = relationship(  # type: ignore[name-defined]
        "Menu",
        foreign_keys=[menu_id],
        lazy="raise",
    )


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = {"schema": "casino"}

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=False
    )
    menu_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.menus.id"), nullable=False
    )
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(ReservationStatus, name="reservation_status", schema="casino", create_type=False),
        nullable=False,
        default=ReservationStatus.active,
    )
    qr_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
