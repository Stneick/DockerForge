from contextlib import asynccontextmanager
from datetime import UTC, datetime

import redis.asyncio as redis_async
from arq import create_pool
from arq.connections import RedisSettings
from docker.errors import DockerException
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

import docker
from app.api.auth import router as auth_router
from app.api.builds import router as builds_router
from app.api.languages import router as languages_router
from app.api.projects import router as projects_router
from app.api.users import router as users_router
from app.config import settings
from app.core.logging import setup_logging
from app.database import engine
from app.schemas.system import RootResponse
from app.services.docker_client import DockerDaemonUnavailableError

setup_logging(settings.LOG_LEVEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.success("database connection verified")
    except Exception as err:
        logger.error("database unavailable, shutting down", error=str(err))
        raise
    try:
        docker_client = docker.from_env()
        docker_client.ping()
        logger.success("successfully connected to Docker daemon")
        docker_client.close()
    except DockerException as err:
        logger.warning(
            f"Docker daemon is not running or not accessible: {err}",
        )

    try:
        app.state.arq_pool = await create_pool(
            RedisSettings(host=settings.REDIS_HOST, port=settings.REDIS_PORT)
        )
        app.state.redis = redis_async.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT
        )
        logger.success("successfully connected to Redis message broker")
    except Exception as err:
        # TODO: if possible/worth it change to only raise when redis is actually needed
        logger.error(f"Redis unavailable, cannot queue background tasks: {err}")
        raise

    yield
    await engine.dispose()
    if hasattr(app.state, "arq_pool"):
        await app.state.arq_pool.close()
    if hasattr(app.state, "redis"):
        await app.state.redis.aclose()


app = FastAPI(
    title="DockerForge API",
    version="0.8",
    description="",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.ENVIRONMENT == "dev" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "dev" else None,
    lifespan=lifespan,
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(languages_router, prefix="/api/v1")
app.include_router(builds_router, prefix="/api/v1")


@app.exception_handler(DockerDaemonUnavailableError)
async def docker_unavailable_handler(
    request: Request, exc: DockerDaemonUnavailableError
):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "error": "Service Unavailable",
            "message": str(exc),
            "resolution": "Ensure Docker Desktop/Daemon is running on the host machine.",
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled exception", method=request.method, path=request.url.path
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=RootResponse)
async def root() -> RootResponse:
    return RootResponse(
        name="DockerForge API",
        version="0.8",
        status="online",
        timestamp=datetime.now(UTC),
    )
