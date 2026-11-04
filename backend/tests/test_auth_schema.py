from datetime import timedelta

from app.schemas.auth import RefreshRequest


def test_refresh_request_requires_token() -> None:
    payload = RefreshRequest(refresh_token="refresh-token")

    assert payload.refresh_token == "refresh-token"
