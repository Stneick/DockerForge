from __future__ import annotations

import re
from functools import lru_cache
from typing import TYPE_CHECKING, Literal
from urllib.parse import quote_plus

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

if TYPE_CHECKING:
    from docker.api.build import _ContainerLimits


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    LOG_LEVEL: str = "info"
    ENVIRONMENT: Literal["dev", "prod"] = "dev"
    DEBUG: bool = True
    COOKIE_SECURE: bool = False

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

    # Docker build
    BUILD_TIMEOUT_SECONDS: int = 600
    BUILD_MAX_CONCURRENT: int = 2
    BUILD_MEMORY_LIMIT: str = "512m"
    IMAGE_TTL_SECONDS: int = 3600

    # Upload
    MAX_UPLOAD_SIZE_MB: int = 100
    PROJECTS_SOURCE_DIR: str = "/var/lib/dockerforge/projects"
    GIT_CLONE_TIMEOUT_SECONDS: int = 120

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )

    @field_validator("BUILD_MEMORY_LIMIT")
    @classmethod
    def validate_memory(cls, v: str) -> str:
        pattern = r"^\d+(k|m|g)$"
        if not re.match(pattern, v.lower()):
            raise ValueError("BUILD_MEMORY_LIMIT must be like '512m', '1g', or '128k'")
        return v.lower()

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

    def parse_memory(self, mem_str: str) -> int:
        units = {"k": 1024, "m": 1024**2, "g": 1024**3}
        return int(mem_str[:-1]) * units[mem_str[-1].lower()]

    @property
    def container_limits(self) -> _ContainerLimits:
        mem = self.parse_memory(self.BUILD_MEMORY_LIMIT)
        return {
            "memory": mem,
            "memswap": mem,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
