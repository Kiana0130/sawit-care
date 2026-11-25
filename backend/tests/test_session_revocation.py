from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_db():
        async with sessions() as session:
            yield session

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        await engine.dispose()


@pytest.mark.asyncio
async def test_password_change_revokes_all_existing_sessions(client):
    email, old, new = "revocation@example.com", "old-password-123", "new-password-456"
    first = (await client.post("/v1/auth/register", json={"name": "Farmer", "email": email, "password": old})).json()["tokens"]
    second = (await client.post("/v1/auth/login", json={"email": email, "password": old})).json()["tokens"]
    other = (await client.post("/v1/auth/register", json={"name": "Other", "email": "other@example.com", "password": old})).json()["tokens"]
    headers = {"Authorization": f"Bearer {first['access_token']}"}
    changed = await client.post("/v1/users/me/password", headers=headers, json={"current_password": old, "new_password": new})
    assert changed.status_code == 204
    for tokens in (first, second):
        assert (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})).status_code == 401
        assert (await client.post("/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})).status_code == 401
    assert (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {other['access_token']}"})).status_code == 200
    assert (await client.post("/v1/auth/refresh", json={"refresh_token": other["refresh_token"]})).status_code == 200
    assert (await client.post("/v1/auth/login", json={"email": email, "password": old})).status_code == 401
    fresh = await client.post("/v1/auth/login", json={"email": email, "password": new})
    assert fresh.status_code == 200
    assert (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {fresh.json()['tokens']['access_token']}"})).status_code == 200
