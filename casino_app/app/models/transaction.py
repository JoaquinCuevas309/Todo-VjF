import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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
        Uuid, ForeignKey("casino.users.id"), nullable=False
    )
    menu_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("casino.menus.id")
    )
    operator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=False
    )
    reservation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("casino.reservations.id")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
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
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    qr_token: Mapped[str | None] = mapped_column(String(64), unique=True)
    reserved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
