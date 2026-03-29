import uuid
from collections.abc import AsyncGenerator

import jwt
from app.core.security import decode_token
from app.database import async_session
from app.models import User
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except jwt.PyJWTError as err:
        raise HTTPException(status_code=401, detail="Invalid token") from err
    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user
