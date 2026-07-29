"""FinSight Backend — FastAPI application entry point."""

import asyncio
import os
import uuid
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from logging_config import configure_logging, get_logger
from routers import upload, analytics, chat, auth as auth_router
from routers import settings as settings_router
from database import engine, Base
from state import upload_progress

configure_logging()
logger = get_logger(__name__)

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from config import validate_config
    validate_config(logger)
    from cache import init_cache, close_cache
    await init_cache()
    # Warm up ML model in background so first request isn't slow
    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _warmup_ml)
    yield
    await close_cache()


def _warmup_ml():
    try:
        from ai.merchant_classifier import MerchantClassifier
        MerchantClassifier.instance()
        logger.info("ML merchant classifier warmed up.")
    except Exception as exc:
        logger.debug("ML warm-up skipped: %s", exc)

# Rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="FinSight",
    description="Local-first financial intelligence API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_CORS_ORIGINS = os.getenv(
    "FINSIGHT_CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "connect-src 'self' http://localhost:11434; "  # Ollama LLM
        "script-src 'none'; "
        "object-src 'none'; "
        "frame-ancestors 'none';"
    )
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method, request.url.path, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again.", "type": type(exc).__name__},
    )


@app.get("/health")
async def health():
    return {"status": "ok", "privacy": "all-local"}


app.include_router(auth_router.router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(upload.router,           prefix="/api/upload",    tags=["Upload"])
app.include_router(analytics.router,        prefix="/api/analytics", tags=["Analytics"])
app.include_router(chat.router,             prefix="/api/chat",      tags=["Chat"])
app.include_router(settings_router.router,  prefix="/api/settings",  tags=["Settings"])


@app.websocket("/ws/upload/{job_id}")
async def upload_progress_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()
    try:
        while True:
            info = upload_progress.get(job_id)
            if info:
                await websocket.send_json(info)
                if info.get("status") in ("done", "error"):
                    break
            await asyncio.sleep(0.25)
    except WebSocketDisconnect:
        pass
    finally:
        upload_progress.pop(job_id, None)
