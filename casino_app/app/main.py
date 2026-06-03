from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.menus import router as menus_router
from app.api.v1.transactions import router as transactions_router
from app.api.v1.reports import router as reports_router
from app.core.exceptions import register_exception_handlers
from app.core.rate_limit import limiter
from app.database import lifespan_db

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with lifespan_db():
        yield


app = FastAPI(
    title="Casino Institucional API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

register_exception_handlers(app)

# Routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(menus_router, prefix="/api/v1")
app.include_router(transactions_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/health", tags=["infra"])
async def health_check():
    return {"status": "ok"}
