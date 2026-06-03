import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    operator = "operator"
    diner = "diner"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(r"rut ~ '^\d{7,8}-[\dkK]$'", name="rut_format"),
        CheckConstraint(
            "email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'",
            name="email_format",
        ),
        {"schema": "casino"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    rut: Mapped[str] = mapped_column(String(12), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, schema="casino"), nullable=False, default=UserRole.diner
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Campos de seguridad anti-fuerza bruta
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Auditoría
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("casino.users.id"), nullable=True
    )

    # Relaciones
    creator: Mapped["User | None"] = relationship("User", remote_side="User.id", foreign_keys=[created_by])
