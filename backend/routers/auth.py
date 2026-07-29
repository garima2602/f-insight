"""Authentication router — register, login, me."""

import re
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token, get_current_user

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.\-]{3,30}$")


class RegisterRequest(BaseModel):
    username:     str = Field(..., min_length=3, max_length=30)
    password:     str = Field(..., min_length=6, max_length=128)
    display_name: str = Field(default="", max_length=60)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("Username may only contain letters, numbers, underscores, dots, or hyphens (3–30 chars).")
        return v.lower()


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    username:     str
    display_name: str


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already taken. Please choose another.")

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        display_name=body.display_name or body.username,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name or user.username,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name or user.username,
    )


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id":      current_user.id,
        "username":     current_user.username,
        "display_name": current_user.display_name or current_user.username,
    }


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(default="", max_length=60)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password:     str = Field(..., min_length=6, max_length=128)


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)


@router.patch("/me/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.display_name = body.display_name.strip() or current_user.username
    await db.commit()
    await db.refresh(current_user)
    return {"display_name": current_user.display_name}


@router.post("/me/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"detail": "Password updated successfully."}


# ── Password reset (self-hosted, no email) ────────────────────────────────────
# Flow: admin runs `python -c "from auth import create_reset_token; print(create_reset_token(user_id))"`,
# pastes the token to the user. User submits it via POST /api/auth/reset-password.

@router.post("/admin/reset-token")
async def generate_reset_token(
    username: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a single-use password reset token for any user.
    Only works when the requesting user's id == 1 (first registered = admin).
    """
    if current_user.id != 1:
        raise HTTPException(status_code=403, detail="Admin only.")
    result = await db.execute(select(User).where(User.username == username.lower()))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    from auth import create_access_token
    token = create_access_token(target.id, target.username)
    return {"reset_token": token, "note": "Share this token with the user. It expires with the normal token TTL."}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Apply a password reset token generated by an admin."""
    from auth import decode_token
    try:
        payload = decode_token(body.reset_token)
    except Exception:
        raise HTTPException(status_code=400, detail="Reset token is invalid or expired.")
    user_id = int(payload.get("sub", 0))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"detail": "Password reset successfully. Please log in with your new password."}
