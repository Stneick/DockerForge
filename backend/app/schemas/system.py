from datetime import datetime
from pydantic import BaseModel


class RootResponse(BaseModel):
    name: str
    version: str
    status: str
    timestamp: datetime