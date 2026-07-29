"""Application configuration."""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"

# Create directories
DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

# Database
# Priority: FINSIGHT_RAM_ONLY → DATABASE_URL env var → default SQLite file
RAM_ONLY_MODE = os.getenv("FINSIGHT_RAM_ONLY", "false").lower() == "true"

if RAM_ONLY_MODE:
    DATABASE_URL = "sqlite+aiosqlite://"
elif os.getenv("DATABASE_URL"):
    _raw = os.environ["DATABASE_URL"]
    # Heroku/Railway ship postgres:// — SQLAlchemy needs postgresql+asyncpg://
    if _raw.startswith("postgres://"):
        _raw = _raw.replace("postgres://", "postgresql+asyncpg://", 1)
    elif _raw.startswith("postgresql://") and "+asyncpg" not in _raw:
        _raw = _raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    DATABASE_URL = _raw
else:
    DATABASE_URL = f"sqlite+aiosqlite:///{DATA_DIR / 'finsight.db'}"

IS_POSTGRES = DATABASE_URL.startswith("postgresql")

# Ollama
OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

# Tesseract
TESSERACT_CMD = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe" if os.name == "nt" else "tesseract")

# Poppler (for pdf2image)
_default_poppler = ""
if os.name == "nt":
    # Check common install locations
    _candidates = [
        r"C:\poppler-25.07.0\Library\bin",
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages",
            "oschwartz10612.Poppler_Microsoft.Winget.Source_8wekyb3d8bbwe",
            "poppler-25.07.0", "Library", "bin"),
    ]
    for _c in _candidates:
        if os.path.isdir(_c):
            _default_poppler = _c
            break
POPPLER_PATH = os.getenv("POPPLER_PATH", _default_poppler)


def validate_config(logger=None):
    """Warn at startup about missing optional dependencies and insecure settings."""
    import logging
    log = logger or logging.getLogger(__name__)

    # Secret key check (auth.py already sys.exit()s if key is set but insecure;
    # here we just surface the dev-mode warning in the structured log)
    if "FINSIGHT_SECRET_KEY" not in os.environ:
        log.warning(
            "FINSIGHT_SECRET_KEY not set — using insecure default. "
            "Safe for local dev only. Set this env var before network deployment."
        )

    if os.name == "nt" and not os.path.isfile(TESSERACT_CMD):
        log.warning("Tesseract not found at %s — OCR for scanned PDFs will be unavailable.", TESSERACT_CMD)
    if POPPLER_PATH and not os.path.isdir(POPPLER_PATH):
        log.warning("Poppler not found at %s — scanned PDF conversion may fail.", POPPLER_PATH)
    if not POPPLER_PATH:
        log.warning("POPPLER_PATH not set — scanned PDF support requires Poppler.")
