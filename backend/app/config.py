from pathlib import Path
from typing import Literal
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    HOST: str = "0.0.0.0"
    PORT: int = 7000
    WORKERS: int = 4
    LOG_LEVEL: str = "info"
    ENVIRONMENT: Literal["dev", "prod"] = "dev"

    DB_USER: str 
    DB_PASSWORD: str
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str

    #TODO
    #JWT SECRETS ENV VARS

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
