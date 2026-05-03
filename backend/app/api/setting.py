from app.core.dependencies import get_app_settings, get_current_user, get_db
from app.models.settings import AppSettings as AppSettingsModel
from app.models.user import User
from app.schemas.settings import AppSettings, UpdateAppSettingsRequest
from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=AppSettings)
async def get_settings(
    settings: AppSettingsModel = Depends(get_app_settings),
    _: User = Depends(get_current_user),
):
    return settings


@router.patch("/", response_model=AppSettings)
async def update_settings(
    data: UpdateAppSettingsRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
    settings: AppSettingsModel = Depends(get_app_settings),
):
    try:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(settings, field, value)
        await db.commit()
        await db.refresh(settings)
    except Exception:
        logger.exception("Failed to update app settings")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update app settings",
        ) from None
    return settings
