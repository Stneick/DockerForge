from app.core.constants import LANGUAGE_INDICATORS
from app.schemas.common import LanguageConfig, LanguageListResponse, SupportedLanguage
from fastapi import APIRouter

router = APIRouter(prefix="/languages", tags=["Languages"])


@router.get("/", response_model=LanguageListResponse)
async def list_languages():
    languages = []
    for lang, config in LANGUAGE_INDICATORS.items():
        languages.append(
            LanguageConfig(
                language=SupportedLanguage(lang),
                display_name=config["display_name"],
                default_base_image=config["default_base_image"],
                dependency_files=config["dependency_files"],
                default_startup_command=config["startup_command"],
                supports_multi_stage=config.get("supports_multi_stage", False),
            )
        )
    return LanguageListResponse(languages=languages)
