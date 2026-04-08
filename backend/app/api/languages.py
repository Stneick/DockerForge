from app.core.languages import LANGUAGES
from app.schemas.languages import (
    FrameworkResponse,
    LanguageListResponse,
    LanguageResponse,
)
from fastapi import APIRouter

router = APIRouter(prefix="/languages", tags=["Languages"])


@router.get("/", response_model=LanguageListResponse)
async def list_languages():
    languages = []
    for lang_key, config in LANGUAGES.items():
        frameworks = [
            FrameworkResponse(
                name=fw["name"],
                display_name=fw["display_name"],
                default_entry_point=fw["default_entry_point"],
                default_startup_command=fw["default_startup_command"],
                default_port=fw["default_port"],
                note=fw["note"],
            )
            for fw in config["frameworks"]
        ]
        languages.append(
            LanguageResponse(
                name=lang_key,
                display_name=config["display_name"],
                default_base_image=config["default_base_image"],
                supports_multi_stage=config["supports_multi_stage"],
                frameworks=frameworks,
            )
        )
    return LanguageListResponse(languages=languages)
