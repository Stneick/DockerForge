import os
import shutil
import stat
from pathlib import Path

from loguru import logger


def force_rmtree(path: Path) -> None:
    """
    shutil.rmtree substitute that handles PermissionError on read-only files.
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


def format_size(size_bytes: int) -> str:
    if size_bytes == 0:
        return "0 B"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def format_size_diff(diff: int) -> str:
    sign = "+" if diff > 0 else ""
    abs_diff = abs(diff)
    if abs_diff == 0:
        return "0 B"
    if abs_diff < 1024:
        return f"{sign}{diff} B"
    elif abs_diff < 1024 * 1024:
        return f"{sign}{diff / 1024:.1f} KB"
    elif abs_diff < 1024 * 1024 * 1024:
        return f"{sign}{diff / (1024 * 1024):.1f} MB"
    else:
        return f"{sign}{diff / (1024 * 1024 * 1024):.1f} GB"
