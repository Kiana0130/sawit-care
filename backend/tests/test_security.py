from datetime import timedelta

import pytest

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_password_hash_round_trip() -> None:
    password = "Strong-password-123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_access_token_contains_user_subject_and_expiry() -> None:
    token = create_access_token("user-123", expires_delta=timedelta(minutes=15))
    payload = decode_access_token(token)

    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert "exp" in payload


def test_invalid_access_token_is_rejected() -> None:
    with pytest.raises(ValueError, match="Invalid token"):
        decode_access_token("not-a-jwt")
