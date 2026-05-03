import uuid
from collections.abc import AsyncGenerator

import jwt
import redis.asyncio as redis_async
from app.core.security import decode_token
from app.database import async_session
from app.models import User
from app.models.project import Project as ProjectModel
from app.models.settings import AppSettings
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyCookie
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


def get_redis(request: Request) -> redis_async.Redis:
    return request.app.state.redis


cookie_scheme = APIKeyCookie(name="access_token")


async def get_current_user(
    token: str = Depends(cookie_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            # TODO maybe change message to just "Invalid token" after frontend is done
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
            )
        user_id = payload.get("sub")
    except jwt.PyJWTError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from err
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found"
        )
    return user


async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectModel:
    result = await db.execute(select(ProjectModel).where(ProjectModel.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    if project.user_id != current_user.id:
        logger.warning(
            f"User {current_user.id} attempted to access project {project_id} owned by {project.user_id}"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


async def get_app_settings(db: AsyncSession = Depends(get_db)) -> AppSettings:
    result = await db.get(AppSettings, 1)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="App settings not found",
        )
    return result
