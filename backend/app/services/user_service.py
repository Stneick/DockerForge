from app.core.security import hash_password, verify_password
from app.models.build import Build
from app.models.project import Project
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UpdateUserRequest, UserProfile
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_user_profile(user: User, db: AsyncSession) -> UserProfile:
    project_count = await db.execute(
        select(func.count()).select_from(Project).where(Project.user_id == user.id)
    )

    build_count = await db.execute(
        select(func.count())
        .select_from(Build)
        .join(Project)
        .where(Project.user_id == user.id)
    )

    return UserProfile(
        id=user.id,
        email=user.email,
        username=user.username,
        total_projects=project_count.scalar() or 0,
        total_builds=build_count.scalar() or 0,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def update_user(
    data: UpdateUserRequest, current_user: User, db: AsyncSession
) -> UserProfile:
    if data.email is not None:
        existing = await db.execute(
            select(User).where(
                (User.email == data.email) & (User.id != current_user.id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already taken")
        current_user.email = data.email

    if data.username is not None:
        existing = await db.execute(
            select(User).where(
                (User.username == data.username) & (User.id != current_user.id)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")
        current_user.username = data.username

    await db.commit()
    await db.refresh(current_user)
    return await get_user_profile(current_user, db)


async def change_user_password(
    data: ChangePasswordRequest, current_user: User, db: AsyncSession
):
    if not await verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password_hash = await hash_password(data.new_password)
    await db.commit()
