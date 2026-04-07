import asyncio
import os
import shutil
import stat
import subprocess
import tarfile
import zipfile
from pathlib import Path
from uuid import UUID

import aiofiles
from app.config import settings
from app.core.constants import ALLOWED_EXTENSIONS
from app.models.project import LanguageEnum, SourceTypeEnum
from app.models.user import User
from app.schemas.project import (
    CloneRequest,
    SourceAnalysisResponse,
)
from app.services.detector import detect_language
from app.services.project_service import _get_project_or_404
from fastapi import HTTPException, UploadFile, status
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession


def _force_rmtree(path: Path) -> None:
    """
    shutil.rmtree substitute that handles PermissionError on read-only files
    Git marks pack files inside .git/objects/ as read-only on Windows.
    """

    def _on_error(func, fpath, exc):
        if isinstance(exc, PermissionError):
            logger.debug(f"Clearing read-only flag on {fpath} and retrying deletion")
            os.chmod(fpath, stat.S_IWRITE)
            func(fpath)
        else:
            logger.error(f"Unexpected error while deleting {fpath}: {exc}")
            raise exc

    shutil.rmtree(path, onexc=_on_error)


def _validate_archive(filename: str) -> str:
    if filename.endswith(".tar.gz") or filename.endswith(".tgz"):
        return "tar"
    elif filename.endswith(".zip"):
        return "zip"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )


async def _extract_archive(temp_path: Path, extract_dir: Path, archive_type: str):
    def _extract():
        if extract_dir.exists():
            _force_rmtree(extract_dir)  # clean previous upload
        extract_dir.mkdir(parents=True, exist_ok=True)

        if archive_type == "zip":
            with zipfile.ZipFile(temp_path) as zf:
                zf.extractall(extract_dir)
        else:
            with tarfile.open(temp_path) as tf:
                tf.extractall(extract_dir, filter="data")

    await asyncio.to_thread(_extract)


async def upload_project_source(
    project_id: UUID, file: UploadFile, user: User, db: AsyncSession
) -> SourceAnalysisResponse:
    project = await _get_project_or_404(project_id, user, db)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Filename is required"
        )

    archive_type = _validate_archive(file.filename)
    temp_path = Path(settings.PROJECTS_SOURCE_DIR) / str(project_id) / file.filename
    temp_path.parent.mkdir(parents=True, exist_ok=True)

    total_size = 0
    async with aiofiles.open(temp_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            total_size += len(chunk)
            if total_size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                await f.close()
                temp_path.unlink()  # delete the partial file
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File too large. Max: {settings.MAX_UPLOAD_SIZE_MB}MB",
                )
            await f.write(chunk)

    extract_dir = Path(settings.PROJECTS_SOURCE_DIR) / str(project_id) / "source"

    await _extract_archive(temp_path, extract_dir, archive_type)
    temp_path.unlink()  # delete the archive

    analysis = await asyncio.to_thread(detect_language, extract_dir)

    project.source_type = SourceTypeEnum.upload
    project.source_uploaded = True
    if analysis.detected_language:
        project.language = LanguageEnum(analysis.detected_language.value)
    if analysis.detected_framework:
        project.framework = analysis.detected_framework
    if analysis.detected_dependency_file:
        project.dependency_file = analysis.detected_dependency_file
    if analysis.suggested_startup_command:
        project.startup_command = analysis.suggested_startup_command
    if analysis.detected_entry_point:
        project.entry_point = analysis.detected_entry_point
    if analysis.detected_binary_name:
        project.binary_name = analysis.detected_binary_name
    if analysis.detected_build_output_dir:
        project.build_output_dir = analysis.detected_build_output_dir
    if analysis.detected_port:
        project.port = analysis.detected_port
    await db.commit()

    return analysis


async def _clone_repo(repo_url: str, clone_dir: Path, branch: str = "main"):
    if clone_dir.exists():
        _force_rmtree(clone_dir)

    def _run_clone():
        return subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                branch,
                repo_url,
                str(clone_dir),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

    try:
        result = await asyncio.to_thread(_run_clone)
    except subprocess.TimeoutExpired as err:
        logger.warning(f"Git clone timed out for {clone_dir}")
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Git clone timed out — repository may be too large or unreachable",
        ) from err

    if result.returncode != 0:
        logger.warning(f"Git clone failed for project {clone_dir}: {result.stderr}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Git clone failed: invalid URL, branch, or repository not accessible",
        )


async def clone_project_repo(
    project_id: UUID, data: CloneRequest, user: User, db: AsyncSession
) -> SourceAnalysisResponse:
    project = await _get_project_or_404(project_id, user, db)

    clone_url = data.repo_url
    if data.access_token:
        clone_url = clone_url.replace("https://", f"https://{data.access_token}@")

    clone_dir = Path(settings.PROJECTS_SOURCE_DIR) / str(project_id) / "source"
    await _clone_repo(clone_url, clone_dir, data.branch)

    analysis = await asyncio.to_thread(detect_language, clone_dir)

    project.source_type = SourceTypeEnum.git
    project.source_uploaded = True
    project.repo_url = data.repo_url
    if analysis.detected_language:
        project.language = LanguageEnum(analysis.detected_language.value)
    if analysis.detected_framework:
        project.framework = analysis.detected_framework
    if analysis.detected_dependency_file:
        project.dependency_file = analysis.detected_dependency_file
    if analysis.suggested_startup_command:
        project.startup_command = analysis.suggested_startup_command
    if analysis.detected_entry_point:
        project.entry_point = analysis.detected_entry_point
    if analysis.detected_binary_name:
        project.binary_name = analysis.detected_binary_name
    if analysis.detected_build_output_dir:
        project.build_output_dir = analysis.detected_build_output_dir
    if analysis.detected_port:
        project.port = analysis.detected_port
    await db.commit()

    return analysis


async def redetect_project(
    project_id: UUID, user: User, db: AsyncSession
) -> SourceAnalysisResponse:
    project = await _get_project_or_404(project_id, user, db)

    if not project.source_uploaded:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No source code uploaded yet",
        )

    source_dir = Path(settings.PROJECTS_SOURCE_DIR) / str(project_id) / "source"
    if not source_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source directory not found. Please re-upload.",
        )

    return await asyncio.to_thread(detect_language, source_dir)
