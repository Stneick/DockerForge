from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UpdateUserRequest, UserProfile
from app.services.user_service import (
    change_user_password,
    get_user_profile,
    update_user,
)
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user), db=Depends(get_db)):
    return await get_user_profile(current_user, db)


@router.patch("/me", response_model=UserProfile)
async def update_me(
    data: UpdateUserRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(data, current_user, db)


@router.put("/me/password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await change_user_password(data, current_user, db)
