from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = structlog.get_logger()


class Base(DeclarativeBase):
    pass


def build_engine() -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_pre_ping=True,
        pool_recycle=1800,
        echo=settings.ENVIRONMENT == "development",
        connect_args={
            "ssl": "prefer",
            "server_settings": {
                "application_name": "casino_app",
                "search_path": "casino",
            },
        },
    )


engine = build_engine()

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def lifespan_db():
    from sqlalchemy import text

    logger.info("db.connecting", url=settings.database_url_safe)
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("db.connected")

    yield

    await engine.dispose()
    logger.info("db.disconnected")
