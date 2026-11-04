from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_auth_routes_are_registered() -> None:
    paths = set(app.openapi()["paths"])

    assert "/v1/auth/register" in paths
    assert "/v1/auth/login" in paths
    assert "/v1/auth/refresh" in paths
    assert "/v1/auth/logout" in paths
    assert "/v1/auth/me" in paths


def test_protected_me_requires_bearer_token() -> None:
    response = client.get("/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"] == "UNAUTHENTICATED"
