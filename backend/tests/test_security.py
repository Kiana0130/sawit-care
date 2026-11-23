from datetime import timedelta

import bcrypt
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)


def test_password_hash_round_trip() -> None:
    password = "Strong-password-123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_bcrypt_password_hash_is_verified_and_marked_for_rehash() -> None:
    password = "Existing-bcrypt-password-123!"
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)
    assert password_needs_rehash(hashed)


def test_argon2_password_hash_does_not_need_rehash() -> None:
    hashed = hash_password("New-argon2-password-123!")

    assert not password_needs_rehash(hashed)


def test_passwords_over_bcrypt_limit_are_supported_without_truncation() -> None:
    prefix = "a" * 72
    password = prefix + "first-suffix"
    different_password = prefix + "other-suffix"
    password_hash = hash_password(password)

    assert verify_password(password, password_hash)
    assert not verify_password(different_password, password_hash)


def test_access_token_contains_user_subject_and_expiry() -> None:
    token = create_access_token("user-123", expires_delta=timedelta(minutes=15))
    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "exp" in payload


def test_invalid_access_token_is_rejected() -> None:
    with pytest.raises(ValueError, match="Invalid token"):
        decode_access_token("not-a-jwt")
