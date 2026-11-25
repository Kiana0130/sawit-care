from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, password_matches, user_response
from app.core.database import get_db
from app.core.security import hash_password
from app.models import RefreshToken, User
from app.schemas.auth import UserResponse
from app.schemas.user import ChangePasswordRequest, DeleteAccountRequest, UpdateProfileRequest

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_profile(user: User = Depends(get_current_user)) -> UserResponse:
    return user_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if payload.email is not None and payload.email != user.email:
        existing = await db.scalar(select(User).where(User.email == payload.email, User.id != user.id))
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="EMAIL_ALREADY_EXISTS")
        user.email = payload.email
    if payload.name is not None:
        user.name = payload.name
    await db.commit()
    await db.refresh(user)
    return user_response(user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    # Reload after acquiring the same lock used by login and refresh.
    previous_version = user.session_version
    user = await db.scalar(select(User).where(User.id == user.id).with_for_update().execution_options(populate_existing=True))
    if user is None or user.session_version != previous_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="UNAUTHENTICATED")
    if not password_matches(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CURRENT_PASSWORD_INVALID")
    user.password_hash = hash_password(payload.new_password)
    user.session_version += 1
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None)).values(revoked_at=datetime.now(timezone.utc)))
    await db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    payload: DeleteAccountRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if payload.confirmation != "HAPUS":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="INVALID_DELETE_CONFIRMATION")
    await db.delete(user)
    await db.commit()
