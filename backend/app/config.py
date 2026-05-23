from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    LOG_LEVEL: str = "info"
    ENVIRONMENT: Literal["dev", "prod"] = "dev"

    # Database
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str = "postgres"
    DB_PORT: int = 5432
    DB_NAME: str

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Worker startup — changing these requires restarting the worker process
    BUILD_MAX_CONCURRENT: int = 2
    # Hard process-level kill ceiling for any single ARQ job.
    # Must be larger than app_settings.build_timeout_seconds.
    ARQ_JOB_TIMEOUT_SECONDS: int = 7800

    # Upload
    PROJECTS_SOURCE_DIR: str = "/var/lib/dockerforge/projects"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )

    @property
    def COOKIE_SECURE(self) -> bool:
        # Secure cookies (HTTPS-only) in prod; relaxed in dev so local
        # HTTP login works.
        return self.ENVIRONMENT == "prod"

    @property
    def COOKIE_SAMESITE(self) -> Literal["lax", "strict"]:
        # Strict in prod (frontend + API share one origin, so same-site
        # XHR still carries the cookie); lax in dev for convenience.
        return "strict" if self.ENVIRONMENT == "prod" else "lax"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://"
            f"{quote_plus(self.DB_USER)}:{quote_plus(self.DB_PASSWORD)}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
