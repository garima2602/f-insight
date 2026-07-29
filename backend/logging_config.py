"""
Centralised logging configuration for FinSight backend.

All modules obtain their logger via:

    from logging_config import get_logger
    logger = get_logger(__name__)

Log levels:
    DEBUG   — fine-grained parsing details (strategy names, column lists)
    INFO    — normal operational events (file processed, rows saved)
    WARNING — recoverable issues (Ollama unreachable, ML fallback used)
    ERROR   — failures that need attention (DB error, parse failure)
"""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """
    Set up the root logger with a consistent format.
    Called once at application startup from main.py.

    Format:  2024-01-15 12:34:56,789 | INFO     | pdf_parser   | Table extraction: 22 rows
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    fmt = "%(asctime)s | %(levelname)-8s | %(name)-22s | %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Avoid duplicate handlers if configure_logging is called more than once
    if not root.handlers:
        root.addHandler(handler)
    else:
        root.handlers.clear()
        root.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
    logging.getLogger("transformers").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Use __name__ as the name."""
    return logging.getLogger(name)
