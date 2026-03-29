import re

from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.user import UserProfile


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not 3 <= len(v) <= 30:
            raise ValueError("Username must be between 3 and 30 characters long")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError(
                "Username can only contain letters, numbers, underscores, and hyphens."
            )
        if v[0] in ["_", "-"] or v[-1] in ["_", "-"]:
            raise ValueError(
                "Username cannot start or end with an underscore or hyphen."
            )
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not 8 <= len(v) <= 128:
            raise ValueError("Password must be between 8 and 128 characters long")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")

        if not re.search(r'[!@#$%^&*(),.?":{}|<>[\]_+=~`-]', v):
            raise ValueError("Password must contain at least one special character")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token TTL in seconds


class AuthResponse(BaseModel):
    user: UserProfile
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
