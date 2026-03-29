from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.api.auth import router as auth_router
from app.config import settings
from app.core.logging import setup_logging
from app.schemas.system import RootResponse

setup_logging(settings.LOG_LEVEL)

app = FastAPI(
    title="DockerForge API",
    version="0.1",
    description="",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.ENVIRONMENT == "dev" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "dev" else None,
)

app.include_router(auth_router, prefix="/api/v1")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled exception", method=request.method, path=request.url.path
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


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
        version="0.1",
        status="online",
        timestamp=datetime.now(UTC),
    )
