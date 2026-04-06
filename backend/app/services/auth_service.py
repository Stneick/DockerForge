import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.core.security import create_token, hash_password, verify_password
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserProfile
from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_tokens(db: AsyncSession, user_id: uuid.UUID) -> dict:
    access_token = create_token(
        data={"sub": str(user_id), "type": "access"},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        data={"sub": str(user_id), "type": "refresh"},
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )

    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    new_token = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_token)
    await db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token}


async def register_user(data: RegisterRequest, db: AsyncSession) -> AuthResponse:
    existing = await db.execute(
        select(User).where(
            (User.email == data.email) | (User.username == data.username)
        )
    )
    if user := existing.scalar_one_or_none():
        if user.email == data.email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Email already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username already exists"
        )

    hashed_password = await hash_password(data.password)
    new_user = User(
        email=data.email, username=data.username, password_hash=hashed_password
    )
    db.add(new_user)
    try:
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError as err:
        await db.rollback()
        # Catch race conditions or any other unique constraint violation
        logger.warning(
            "integrity error during registration", email=data.email, error=str(err)
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already exists",
        ) from err

    tokens = await _create_tokens(db, new_user.id)

    return AuthResponse(
        user=UserProfile.model_validate(new_user),
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def login_user(data: LoginRequest, db: AsyncSession) -> AuthResponse:
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not await verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    tokens = await _create_tokens(db, user.id)

    return AuthResponse(
        user=UserProfile.model_validate(user),
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def refresh_access_token(refresh_token: str, db: AsyncSession) -> TokenResponse:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token = result.scalar_one_or_none()

    if not token or token.revoked or token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token.revoked = True
    await db.commit()
    new_tokens = await _create_tokens(db, token.user_id)

    return TokenResponse(
        access_token=new_tokens["access_token"],
        refresh_token=new_tokens["refresh_token"],
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def logout_user(refresh_token: str, db: AsyncSession) -> None:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    token = result.scalar_one_or_none()

    if not token or token.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    token.revoked = True
    await db.commit()
