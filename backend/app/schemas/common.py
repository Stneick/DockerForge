from enum import Enum

from pydantic import BaseModel


class Pagination(BaseModel):
    page: int
    per_page: int
    total_items: int
    total_pages: int


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str
    message: str
    detail: str | None = None


class ValidationErrorResponse(BaseModel):
    error: str = "validation_error"
    message: str
    details: list[dict]  # [{field: str, message: str}]


class SupportedLanguage(str, Enum):
    PYTHON = "python"
    NODE = "node"
    GO = "go"
    JAVA = "java"
    CPP = "cpp"
    C = "c"
    RUST = "rust"
