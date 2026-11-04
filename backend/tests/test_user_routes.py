from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_user_profile_route_is_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert "/v1/users/me" in paths
