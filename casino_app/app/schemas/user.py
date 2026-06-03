import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, SecretStr, field_validator, model_validator

from app.models.user import UserRole

# Patrones de validación
_RUT_RE = re.compile(r"^\d{7,8}-[\dkK]$")
_EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)
# Solo letras (incluye acentos/ñ), números, espacios, guión y punto
_SAFE_NAME_RE = re.compile(r"^[a-zA-ZÀ-ÿ0-9\s\-\.]+$")


# ---------------------------------------------------------------------------
# Schemas de entrada
# ---------------------------------------------------------------------------


class UserLogin(BaseModel):
    """Acepta RUT (12345678-9) o email como identificador."""

    identifier: str
    password: SecretStr

    @field_validator("identifier")
    @classmethod
    def validate_identifier(cls, v: str) -> str:
        v = v.strip()
        if len(v) > 255:
            raise ValueError("Identificador demasiado largo")
        is_rut = bool(_RUT_RE.match(v.upper()))
        is_email = bool(_EMAIL_RE.match(v))
        if not is_rut and not is_email:
            raise ValueError("Debe ser RUT válido (12345678-9) o email válido")
        return v

    @field_validator("password")
    @classmethod
    def password_not_empty(cls, v: SecretStr) -> SecretStr:
        if not v.get_secret_value().strip():
            raise ValueError("La contraseña no puede estar vacía")
        return v


class UserCreate(BaseModel):
    rut: str
    email: str | None = None
    full_name: str
    password: SecretStr
    role: UserRole = UserRole.diner

    @field_validator("rut")
    @classmethod
    def validate_rut(cls, v: str) -> str:
        v = v.strip().upper()
        if not _RUT_RE.match(v):
            raise ValueError("RUT inválido. Formato esperado: 12345678-9 o 12345678-K")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Email inválido")
        if len(v) > 255:
            raise ValueError("Email demasiado largo")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not _SAFE_NAME_RE.match(v):
            raise ValueError("Nombre contiene caracteres no permitidos")
        if len(v) < 3 or len(v) > 255:
            raise ValueError("Nombre debe tener entre 3 y 255 caracteres")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: SecretStr) -> SecretStr:
        pw = v.get_secret_value()
        errors = []
        if len(pw) < 10:
            errors.append("mínimo 10 caracteres")
        if not re.search(r"[A-Z]", pw):
            errors.append("al menos una mayúscula")
        if not re.search(r"[a-z]", pw):
            errors.append("al menos una minúscula")
        if not re.search(r"\d", pw):
            errors.append("al menos un número")
        if not re.search(r"[^A-Za-z0-9]", pw):
            errors.append("al menos un carácter especial")
        if errors:
            raise ValueError(f"Contraseña débil: {', '.join(errors)}")
        return v


class UserUpdate(BaseModel):
    """Actualización parcial — todos los campos son opcionales."""

    email: str | None = None
    full_name: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not _SAFE_NAME_RE.match(v):
            raise ValueError("Nombre contiene caracteres no permitidos")
        return v


# ---------------------------------------------------------------------------
# Schemas de salida (nunca exponen password_hash)
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    rut: str
    email: str | None
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos hasta expiración
