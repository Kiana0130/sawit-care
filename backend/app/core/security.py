import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import settings


password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith("$argon2"):
        try:
            return password_hasher.verify(password_hash, password)
        except VerifyMismatchError:
            return False
        except (InvalidHashError, VerificationError, TypeError, ValueError):
            return False

    try:
        # Older Sawit Care accounts used bcrypt, which only considers 72 bytes.
        return bcrypt.checkpw(password.encode("utf-8")[:72], password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    if not password_hash.startswith("$argon2"):
        return True
    try:
        return password_hasher.check_needs_rehash(password_hash)
    except (InvalidHashError, VerificationError, TypeError, ValueError):
        return True


def create_access_token(subject: str, expires_delta: timedelta | None = None, *, session_version: int = 0) -> str:
    expires_delta = expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    now = datetime.now(timezone.utc)
    payload = {"sub": subject, "type": "access", "session_version": session_version, "iat": now, "exp": now + expires_delta}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid token") from exc
    if payload.get("type") != "access" or not payload.get("sub"):
        raise ValueError("Invalid token")
    return payload


def create_refresh_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def validate_runtime_settings() -> None:
    if settings.environment.lower() == "development":
        return

    if len(settings.jwt_secret_key.encode("utf-8")) < 32:
        raise RuntimeError("JWT_SECRET_KEY must contain at least 32 bytes outside development")
    if settings.jwt_secret_key == "development-only-secret-change-before-deploy-32-bytes":
        raise RuntimeError("JWT_SECRET_KEY must be changed outside development")
