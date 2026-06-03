import asyncio
import os
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# --- AQUÍ ESTÁ LO QUE TE FALTA ---
# Importa tu Base y TODOS tus modelos. 
from casino_app.database import Base
from casino_app.models.user import User
from casino_app.models.menu import Menu, MenuItem
from casino_app.models.transaction import Transaction, Reservation

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Conecta el metadata para que detecte los cambios automáticamente
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = os.environ.get("DATABASE_URL")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(
        connection=connection, 
        target_metadata=target_metadata,
        compare_type=True  # Detecta cambios en tipos de columnas (ej: String a Text)
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    # Usa la URL de tu base de datos desde el entorno
    connectable = create_async_engine(
        os.environ.get("DATABASE_URL"),
        poolclass=pool.NullPool,
    )

    asyncio.run(connectable.connect(lambda conn: do_run_migrations(conn)))

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()