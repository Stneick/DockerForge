from typing import Literal

from pydantic import BaseModel, Field


class LintRequest(BaseModel):
    dockerfile: str | None = None


class LintIssue(BaseModel):
    code: str = Field(..., description="Rule code, e.g. DL3008, SC2086")
    message: str
    level: Literal["error", "warning", "info", "style"]
    line: int
    column: int


class LintResponse(BaseModel):
    issues: list[LintIssue]
