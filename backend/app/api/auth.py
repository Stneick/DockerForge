from app.core.dependencies import get_db
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.services.auth_service import (
    login_user,
    logout_user,
    refresh_access_token,
    register_user,
)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    return await register_user(data, db)


@router.post("/login", response_model=AuthResponse, status_code=200)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    return await login_user(data, db)


@router.post("/refresh", response_model=TokenResponse, status_code=200)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_access_token(data, db)


@router.post("/logout", status_code=200)
async def logout(token: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await logout_user(token, db)
