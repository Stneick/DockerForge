from fastapi import FastAPI
from datetime import datetime, UTC
from app.schemas.system import RootResponse

app = FastAPI(
    title="DockerForge API",
    version="0.1",
    description="",
)

#TODO
# configurable CORS middleware origin
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

@app.get("/", response_model=RootResponse)
async def root() -> RootResponse:
    return RootResponse(
        name="DockerForge API",
        version="0.1",
        status="online",
        timestamp=datetime.now(UTC).isoformat(),
    )