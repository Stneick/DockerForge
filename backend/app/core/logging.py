import logging
import sys

from loguru import logger


class _InterceptHandler(logging.Handler):
    """Route stdlib/uvicorn logs into loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging(log_level: str = "INFO") -> None:
    level = log_level.upper()

    logger.remove()
    logger.add(sys.stdout, level=level, colorize=True)
    logger.add(
        "logs/dockerforge.log",
        level=level,
        rotation="10 MB",
        retention="7 days",
        compression="zip",
        enqueue=True,
    )

    intercept_handler = _InterceptHandler()
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(name).handlers = [intercept_handler]
        logging.getLogger(name).propagate = False
