from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import ensure_unique_email, get_current_user, password_matches, refresh_expiry, user_response
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    hash_refresh_token,
    password_needs_rehash,
)
from app.models import RefreshToken, User
from app.schemas.auth import AuthResponse, LoginRequest, RefreshRequest, TokenResponse, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def make_tokens(user: User, raw_refresh: str) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), session_version=user.session_version),
        refresh_token=raw_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


def auth_response(user: User, raw_refresh: str) -> AuthResponse:
    return AuthResponse(user=user_response(user), tokens=make_tokens(user, raw_refresh))


async def persist_refresh_token(db: AsyncSession, user: User) -> str:
    raw_refresh, refresh_hash = create_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=refresh_expiry()))
    return raw_refresh


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    existing_user = await db.scalar(select(User).where(User.email == payload.email))
    ensure_unique_email(existing_user)

    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password), plan="free")
    db.add(user)
    await db.flush()
    raw_refresh = await persist_refresh_token(db, user)
    await db.commit()
    return auth_response(user, raw_refresh)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthResponse:
    user = await db.scalar(select(User).where(User.email == payload.email).with_for_update())
    if user is None or not password_matches(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="INVALID_CREDENTIALS")
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)

    raw_refresh = await persist_refresh_token(db, user)
    await db.commit()
    return auth_response(user, raw_refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    token_hash = hash_refresh_token(payload.refresh_token)
    # All session issuance and password changes lock the user first.
    user = await db.scalar(
        select(User).join(RefreshToken, User.id == RefreshToken.user_id)
        .where(RefreshToken.token_hash == token_hash).with_for_update(of=User)
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    token = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update())
    now = datetime.now(timezone.utc)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if token.revoked_at is not None or expires_at <= now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")

    token.revoked_at = now
    raw_refresh = await persist_refresh_token(db, user)
    await db.commit()
    return make_tokens(user, raw_refresh)


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return user_response(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)))
    for token in result.scalars():
        token.revoked_at = datetime.now(timezone.utc)
    await db.commit()
