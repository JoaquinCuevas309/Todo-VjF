"""
alembic/env.py — Configuración de migraciones.

Puntos clave de esta configuración:
  • Motor ASYNC (asyncpg): usa async_engine_from_config + run_sync.
  • Schema personalizado 'casino': se crea automáticamente si no existe.
  • include_object filtra solo objetos del schema 'casino' para que
    Alembic no toque tablas del schema 'public' u otros.
  • La URL de BD se lee de app.config.settings (desde el .env) en lugar
    de hardcodearla en alembic.ini.
"""

import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import async_engine_from_config

# ── Hacer importable el paquete 'app' ────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings
from app.database import Base

# ── Importar TODOS los modelos para que Alembic los detecte ──────
# Si olvidas un modelo aquí, autogenerate no lo incluirá.
from app.models.user import User          # noqa: F401
from app.models.menu import Menu, MenuItem  # noqa: F401
from app.models.transaction import Transaction, Reservation  # noqa: F401

# ─────────────────────────────────────────────────────────────────
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


# ── Filtro: solo objetos del schema 'casino' ─────────────────────
def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return getattr(object, "schema", None) == "casino"
    # Enums, índices y constraints sin schema explícito → incluir
    return True


# ─────────────────────────────────────────────────────────────────
# MODO OFFLINE: genera SQL sin conectarse a la BD
# ─────────────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        include_object=include_object,
        version_table_schema="casino",
    )
    with context.begin_transaction():
        context.run_migrations()


# ─────────────────────────────────────────────────────────────────
# MODO ONLINE: conecta a la BD y ejecuta las migraciones
# ─────────────────────────────────────────────────────────────────
def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        include_object=include_object,
        version_table_schema="casino",
        compare_type=True,          # detecta cambios de tipo de columna
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    # Sobreescribir la URL del .ini con la de settings
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = settings.database_url

    connectable = async_engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,    # sin pool para migraciones (procesos cortos)
    )

    async with connectable.connect() as connection:
        # Crear el schema 'casino' si no existe (requerido antes de la 1.ª migración)
        await connection.execute(text("CREATE SCHEMA IF NOT EXISTS casino"))
        await connection.commit()

        # Ejecutar las migraciones de forma síncrona sobre la conexión async
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


# ─────────────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
