from app.config import settings
from app.core.dependencies import get_db
from app.schemas.auth import (
    AuthUserResponse,
    LoginRequest,
    RegisterRequest,
)
from app.schemas.common import MessageResponse
from app.services.auth_service import (
    login_user,
    logout_user,
    refresh_access_token,
    register_user,
)
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        path="/api/v1/auth/refresh",
        secure=settings.COOKIE_SECURE,
        samesite="lax",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )


@router.post(
    "/register", response_model=AuthUserResponse, status_code=status.HTTP_201_CREATED
)
async def register(
    data: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = await register_user(data, db)
    _set_auth_cookies(response, user.access_token, user.refresh_token)
    return user


@router.post("/login", response_model=AuthUserResponse, status_code=status.HTTP_200_OK)
async def login(
    data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)
):
    user = await login_user(data, db)
    _set_auth_cookies(response, user.access_token, user.refresh_token)
    return user


@router.post("/refresh", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def refresh(
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing"
        )

    tokens = await refresh_access_token(refresh_token, db)
    _set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return MessageResponse(message="Tokens refreshed")


@router.post("/logout", response_model=MessageResponse, status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    refresh_token: str = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing"
        )
    # path, secure, and samesite must match the original Set-Cookie exactly,
    response.delete_cookie(
        "access_token", path="/", secure=settings.COOKIE_SECURE, samesite="lax"
    )
    response.delete_cookie(
        "refresh_token",
        path="/api/v1/auth/refresh",
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )
    await logout_user(refresh_token, db)
    return MessageResponse(message="Successfully logged out")
