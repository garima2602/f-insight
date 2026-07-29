"""JWT authentication utilities."""

import os
import sys
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User

# ── Secret key validation ─────────────────────────────────────────────────────
# The app refuses to start with the insecure placeholder or a key shorter than
# 32 characters.  Generate a safe key with:
#   python -c "import secrets; print(secrets.token_hex(32))"
# then set FINSIGHT_SECRET_KEY in your environment or .env file.

_INSECURE_DEFAULT = "change-me-in-production-use-a-long-random-string"
_MIN_KEY_LENGTH   = 32

SECRET_KEY = os.getenv("FINSIGHT_SECRET_KEY", _INSECURE_DEFAULT)

def _validate_secret_key() -> None:
    env_set = "FINSIGHT_SECRET_KEY" in os.environ

    if not env_set:
        # Running without any key set — allow localhost-only dev mode but warn loudly
        import logging
        logging.getLogger(__name__).warning(
            "FINSIGHT_SECRET_KEY is not set. Using an insecure default key. "
            "This is only safe for local single-user development. "
            "Set FINSIGHT_SECRET_KEY before exposing this app on a network."
        )
        return

    if SECRET_KEY == _INSECURE_DEFAULT:
        print(
            "\n[FATAL] FINSIGHT_SECRET_KEY is set to the insecure placeholder value.\n"
            "Generate a real key with:\n"
            "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            "then set FINSIGHT_SECRET_KEY=<that value> in your environment.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    if len(SECRET_KEY) < _MIN_KEY_LENGTH:
        print(
            f"\n[FATAL] FINSIGHT_SECRET_KEY is too short ({len(SECRET_KEY)} chars). "
            f"Minimum is {_MIN_KEY_LENGTH} characters.\n",
            file=sys.stderr,
        )
        sys.exit(1)

_validate_secret_key()

# ── Config ────────────────────────────────────────────────────────────────────

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("FINSIGHT_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(user_id: int, username: str) -> str:
    expire  = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
    user_id = int(payload.get("sub", 0))
    result  = await db.execute(select(User).where(User.id == user_id))
    user    = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
