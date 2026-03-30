import hashlib
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.core.security import create_token, hash_password
from app.models.user import RefreshToken, User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserProfile
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def _create_tokens(db: AsyncSession, user: User) -> dict:
    access_token = create_token(
        data={"sub": str(user.id), "type": "access"},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    refresh_token = create_token(
        data={"sub": str(user.id), "type": "refresh"},
        expires_delta=timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    )

    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    new_token = RefreshToken(
        user_id=user.id,
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
            raise HTTPException(status_code=409, detail="Email already exists")
        raise HTTPException(status_code=409, detail="Username already exists")

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or username already exists",
        ) from err

    tokens = await _create_tokens(db, new_user)

    return AuthResponse(
        user=UserProfile.model_validate(new_user),
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def login_user(data: LoginRequest, db: AsyncSession) -> AuthResponse:
    raise NotImplementedError


async def refresh_access_token(data: RefreshRequest, db: AsyncSession) -> TokenResponse:
    raise NotImplementedError


async def logout_user(data: RefreshRequest, db: AsyncSession) -> None:
    raise NotImplementedError
