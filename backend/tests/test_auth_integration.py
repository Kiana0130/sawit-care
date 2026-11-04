import os
from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

os.environ["DATABASE_URL"] = "postgresql+asyncpg://sawitcare:sawitcare@127.0.0.1:55432/sawitcare"

from app.core.database import get_db  # noqa: E402
from app.main import app  # noqa: E402


TEST_DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(TEST_DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_auth_lifecycle_against_postgres() -> None:
    email = f"integration-{uuid4()}@example.com"
    password = "Strong-password-123!"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register = await client.post(
            "/v1/auth/register",
            json={"name": "Petani Integrasi", "email": email, "password": password},
        )
        assert register.status_code == 201
        session = register.json()["tokens"]
        assert session["expires_in"] == 900

        profile = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {session['access_token']}"})
        assert profile.status_code == 200
        assert profile.json()["email"] == email

        refresh = await client.post("/v1/auth/refresh", json={"refresh_token": session["refresh_token"]})
        assert refresh.status_code == 200
        refreshed = refresh.json()
        assert refreshed["refresh_token"] != session["refresh_token"]

        old_refresh = await client.post("/v1/auth/refresh", json={"refresh_token": session["refresh_token"]})
        assert old_refresh.status_code == 401

        login = await client.post("/v1/auth/login", json={"email": email.upper(), "password": password})
        assert login.status_code == 200
        login_session = login.json()["tokens"]

        logout = await client.post(
            "/v1/auth/logout",
            headers={"Authorization": f"Bearer {login_session['access_token']}"},
        )
        assert logout.status_code == 204

        delete = await client.request(
            "DELETE",
            "/v1/users/me",
            headers={"Authorization": f"Bearer {login_session['access_token']}"},
            json={"confirmation": "HAPUS"},
        )
        assert delete.status_code == 204

    await engine.dispose()
