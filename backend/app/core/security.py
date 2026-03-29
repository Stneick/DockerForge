import asyncio
from datetime import datetime, timedelta, timezone

import jwt
from app.config import settings
from pwdlib import PasswordHash

pwd_context = PasswordHash.recommended()


async def hash_password(plain_password: str) -> str:
    return await asyncio.to_thread(pwd_context.hash, plain_password)


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    return await asyncio.to_thread(pwd_context.verify, plain_password, hashed_password)


def create_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
