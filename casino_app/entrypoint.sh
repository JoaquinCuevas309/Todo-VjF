#!/bin/bash
set -e

echo "⏳ Esperando a que PostgreSQL esté listo..."

# Espera activa hasta que la BD acepte conexiones
until python - <<EOF
import asyncio, asyncpg, os, sys
async def check():
    try:
        conn = await asyncpg.connect(
            host=os.environ["DB_HOST"],
            port=int(os.environ.get("DB_PORT", 5432)),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            database=os.environ["DB_NAME"],
        )
        await conn.close()
    except Exception as e:
        sys.exit(1)
asyncio.run(check())
EOF
do
  echo "   PostgreSQL no disponible, reintentando en 2s..."
  sleep 2
done

echo "✅ PostgreSQL listo."
echo "🔄 Ejecutando migraciones Alembic..."

alembic upgrade head

echo "🚀 Iniciando servidor FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
