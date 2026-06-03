import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, SmallInteger, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Menu(Base):
    __tablename__ = "menus"
    __table_args__ = (
        CheckConstraint("max_portions > 0", name="max_portions_positive"),
        CheckConstraint("served_portions <= max_portions", name="served_lte_max"),
        {"schema": "casino"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    max_portions: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    served_portions: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    items: Mapped[list["MenuItem"]] = relationship(back_populates="menu", cascade="all, delete-orphan")


class MenuItem(Base):
    __tablename__ = "menu_items"
    __table_args__ = {"schema": "casino"}

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    menu_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("casino.menus.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    calories: Mapped[int | None] = mapped_column(SmallInteger)
    allergens: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)

    menu: Mapped["Menu"] = relationship(back_populates="items")
