import re
from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, field_validator, model_validator

# Solo letras (con acentos), números, espacios y puntuación básica de alimentos
_SAFE_TEXT_RE = re.compile(r"^[a-zA-ZÀ-ÿ0-9\s\-\.\,\(\)\/]+$")

VALID_CATEGORIES = frozenset({"entrada", "fondo", "postre", "bebida", "ensalada", "otro"})
VALID_ALLERGENS = frozenset(
    {"gluten", "lactosa", "huevo", "mariscos", "nueces", "soya", "maní", "pescado"}
)


# ---------------------------------------------------------------------------
# MenuItems
# ---------------------------------------------------------------------------


class MenuItemCreate(BaseModel):
    name: str
    category: str | None = None
    calories: int | None = None
    allergens: list[str] = []

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError("Nombre debe tener entre 1 y 255 caracteres")
        if not _SAFE_TEXT_RE.match(v):
            raise ValueError("Nombre contiene caracteres no permitidos")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip().lower()
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Categoría debe ser una de: {sorted(VALID_CATEGORIES)}")
        return v

    @field_validator("calories")
    @classmethod
    def validate_calories(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("Calorías debe ser un valor positivo")
        if v is not None and v > 9999:
            raise ValueError("Calorías supera el valor máximo permitido (9999)")
        return v

    @field_validator("allergens")
    @classmethod
    def validate_allergens(cls, v: list[str]) -> list[str]:
        normalized = [a.strip().lower() for a in v]
        invalid = set(normalized) - VALID_ALLERGENS
        if invalid:
            raise ValueError(
                f"Alérgenos no reconocidos: {invalid}. "
                f"Válidos: {sorted(VALID_ALLERGENS)}"
            )
        return normalized


class MenuItemOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    menu_id: UUID
    name: str
    category: str | None
    calories: int | None
    allergens: list[str]


# ---------------------------------------------------------------------------
# Menús
# ---------------------------------------------------------------------------


class MenuCreate(BaseModel):
    service_date: date
    name: str
    description: str | None = None
    max_portions: int
    items: list[MenuItemCreate] = []

    @field_validator("service_date")
    @classmethod
    def date_not_in_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("service_date no puede ser una fecha pasada")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError("Nombre debe tener entre 1 y 255 caracteres")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 1000:
            raise ValueError("Descripción no puede superar los 1000 caracteres")
        return v

    @field_validator("max_portions")
    @classmethod
    def validate_max_portions(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("max_portions debe ser mayor a cero")
        if v > 10_000:
            raise ValueError("max_portions excede el límite permitido (10 000)")
        return v


class MenuUpdate(BaseModel):
    """Actualización parcial — solo los campos enviados se modifican."""

    name: str | None = None
    description: str | None = None
    max_portions: int | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if not v or len(v) > 255:
            raise ValueError("Nombre debe tener entre 1 y 255 caracteres")
        return v

    @field_validator("max_portions")
    @classmethod
    def validate_max_portions(cls, v: int | None) -> int | None:
        if v is None:
            return None
        if v <= 0:
            raise ValueError("max_portions debe ser mayor a cero")
        if v > 10_000:
            raise ValueError("max_portions excede el límite permitido (10 000)")
        return v

    @model_validator(mode="after")
    def at_least_one_field(self) -> "MenuUpdate":
        if all(v is None for v in self.model_dump().values()):
            raise ValueError("Debe enviar al menos un campo para actualizar")
        return self


# ---------------------------------------------------------------------------
# Respuestas
# ---------------------------------------------------------------------------


class MenuOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    service_date: date
    name: str
    description: str | None
    max_portions: int
    served_portions: int
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    items: list[MenuItemOut] = []

    @property
    def available_portions(self) -> int:
        return self.max_portions - self.served_portions


class MenuSummary(BaseModel):
    """Vista compacta para listados — sin ítems detallados."""

    model_config = {"from_attributes": True}

    id: UUID
    service_date: date
    name: str
    max_portions: int
    served_portions: int
    is_active: bool
