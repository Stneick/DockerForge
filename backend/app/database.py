from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    pool_use_lifo=True,
    connect_args={
        "timeout": 10,
        "command_timeout": 30,
    },
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
