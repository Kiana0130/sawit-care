from collections.abc import AsyncGenerator
from datetime import date, datetime, timezone
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models import DailyScanUsage, DiseaseClass, RefreshToken, Scan, User

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite://")
engine = create_async_engine(TEST_DATABASE_URL, poolclass=StaticPool, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(autouse=True)
async def create_test_database():
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.mark.asyncio
async def test_register_login_refresh_logout_and_delete_account():
    email = f"test-{uuid.uuid4()}@example.com"
    password = "Strong-password-123!"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        register = await client.post("/v1/auth/register", json={"name": "Test Farmer", "email": email, "password": password})
        assert register.status_code == 201
        registration_tokens = register.json()["tokens"]
        assert registration_tokens["expires_in"] == 900

        profile = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {registration_tokens['access_token']}"})
        assert profile.status_code == 200
        assert profile.json()["email"] == email

        refresh = await client.post("/v1/auth/refresh", json={"refresh_token": registration_tokens["refresh_token"]})
        assert refresh.status_code == 200
        refreshed_tokens = refresh.json()
        assert refreshed_tokens["refresh_token"] != registration_tokens["refresh_token"]
        revoked_refresh = await client.post("/v1/auth/refresh", json={"refresh_token": registration_tokens["refresh_token"]})
        assert revoked_refresh.status_code == 401

        login = await client.post("/v1/auth/login", json={"email": email.upper(), "password": password})
        assert login.status_code == 200
        login_tokens = login.json()["tokens"]

        logout = await client.post("/v1/auth/logout", headers={"Authorization": f"Bearer {login_tokens['access_token']}"})
        assert logout.status_code == 204

        delete = await client.request("DELETE", "/v1/users/me", headers={"Authorization": f"Bearer {login_tokens['access_token']}"}, json={"confirmation": "HAPUS"})
        assert delete.status_code == 204


@pytest.mark.asyncio
async def test_login_upgrades_legacy_bcrypt_password_hash():
    import bcrypt

    password = "Legacy-bcrypt-password-123!"
    user_id = uuid.uuid4()
    async with SessionLocal() as session:
        session.add(User(id=user_id, name="Legacy Farmer", email=f"legacy-{user_id}@example.com", password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(), plan="free"))
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post("/v1/auth/login", json={"email": f"legacy-{user_id}@example.com", "password": password})
        assert login.status_code == 200

    async with SessionLocal() as session:
        user = await session.get(User, user_id)
        assert user is not None
        assert user.password_hash.startswith("$argon2")


@pytest.mark.asyncio
async def test_invalid_token_subject_returns_401():
    token = create_access_token("not-a-uuid")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
