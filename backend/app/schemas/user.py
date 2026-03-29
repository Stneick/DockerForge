from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    username: str
    total_projects: int = 0
    total_builds: int = 0
    created_at: datetime
    updated_at: datetime
