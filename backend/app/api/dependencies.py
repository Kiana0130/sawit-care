import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import UserResponse

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED") from exc

    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED") from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or type(payload.get("session_version", 0)) is not int or payload.get("session_version", 0) != user.session_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    return user


def effective_plan(user: User) -> str:
    expiry = user.pro_expires_at
    if expiry is not None:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        if user.plan == "pro" and expiry > datetime.now(timezone.utc):
            return "pro"
    return "free"


def user_response(user: User) -> UserResponse:
    return UserResponse(id=str(user.id), name=user.name, email=user.email, plan=effective_plan(user))


def refresh_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)


def password_matches(password: str, password_hash: str) -> bool:
    try:
        return verify_password(password, password_hash)
    except (ValueError, TypeError):
        return False


def ensure_unique_email(existing_user: User | None) -> None:
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="EMAIL_ALREADY_EXISTS")
