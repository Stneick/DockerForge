from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.schemas.system import RootResponse

app = FastAPI(
    title="DockerForge API",
    version="0.1",
    description="",
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
        version="0.1",
        status="online",
        timestamp=datetime.now(UTC),
    )
