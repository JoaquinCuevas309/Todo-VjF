"""fix server_defaults and monetary type

Revision ID: 0001
Revises:
Create Date: 2026-06-03

Cambios:
  - Agrega SERVER DEFAULT NOW() a todas las columnas de timestamp que antes
    dependían de python-side defaults (datetime.utcnow). Esto garantiza que los
    INSERTs sin valor explícito usen la hora del servidor PostgreSQL (aware UTC),
    no un datetime naive generado en Python.
  - Declara los índices que el ORM ahora expresa explícitamente en los modelos
    (transactions.user_id, operator_id, created_at) para que Alembic los
    reconozca y no intente volver a crearlos si ya existen en la BD.

Nota sobre amount (Numeric/Decimal):
  El tipo de columna en BD nunca cambió (siempre fue NUMERIC(10,2)).
  Solo cambia la anotación Python de float → Decimal. No se requiere ALTER TABLE.

Nota sobre tipos ENUM:
  Las columnas tx_status, payment_method y reservation_status ya son tipos ENUM
  nativos de PostgreSQL (creados por init_db.sql). El ORM ahora usa
  SAEnum(..., create_type=False) para reflejar esto. No se requiere ALTER TABLE.
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────
    op.alter_column(
        "users",
        "created_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )
    op.alter_column(
        "users",
        "updated_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )

    # ── menus ─────────────────────────────────────────────────────────────
    op.alter_column(
        "menus",
        "created_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )
    op.alter_column(
        "menus",
        "updated_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )

    # ── transactions ──────────────────────────────────────────────────────
    op.alter_column(
        "transactions",
        "created_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )

    # ── reservations ──────────────────────────────────────────────────────
    op.alter_column(
        "reservations",
        "reserved_at",
        schema="casino",
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
        server_default=sa.text("NOW()"),
    )

    # ── Índices en transactions (ya existen en BD via init_db.sql) ─────────
    # create_index con if_not_exists=True para que sea idempotente.
    op.create_index(
        "idx_tx_user",
        "transactions",
        ["user_id"],
        schema="casino",
        if_not_exists=True,
    )
    op.create_index(
        "idx_tx_operator",
        "transactions",
        ["operator_id"],
        schema="casino",
        if_not_exists=True,
    )
    op.create_index(
        "idx_tx_date",
        "transactions",
        ["created_at"],
        schema="casino",
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_tx_date", table_name="transactions", schema="casino")
    op.drop_index("idx_tx_operator", table_name="transactions", schema="casino")
    op.drop_index("idx_tx_user", table_name="transactions", schema="casino")

    for table, col in [
        ("reservations", "reserved_at"),
        ("transactions", "created_at"),
        ("menus", "updated_at"),
        ("menus", "created_at"),
        ("users", "updated_at"),
        ("users", "created_at"),
    ]:
        op.alter_column(
            table,
            col,
            schema="casino",
            existing_type=sa.DateTime(timezone=True),
            server_default=None,
        )
