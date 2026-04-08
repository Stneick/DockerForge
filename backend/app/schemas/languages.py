from pydantic import BaseModel


class FrameworkResponse(BaseModel):
    name: str
    display_name: str
    default_entry_point: str | None = None
    default_startup_command: str
    default_port: int | None = None
    note: str | None = None


class LanguageResponse(BaseModel):
    name: str
    display_name: str
    default_base_image: str
    supports_multi_stage: bool
    frameworks: list[FrameworkResponse]


class LanguageListResponse(BaseModel):
    languages: list[LanguageResponse]
