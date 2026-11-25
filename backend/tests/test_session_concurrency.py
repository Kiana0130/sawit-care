import asyncio
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def client():
    # Explicit opt-in: this database must be a disposable, dedicated PostgreSQL database.
    url = os.environ.get("DISPOSABLE_SESSION_TEST_DATABASE_URL")
    if not url:
        pytest.skip("requires a dedicated disposable PostgreSQL database")
    engine = create_async_engine(url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async def override():
        async with sessions() as session:
            yield session
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.mark.asyncio
async def test_concurrent_refresh_and_password_change_cannot_preserve_old_sessions(client):
    old, new = "old-password-123", "new-password-456"
    email = "race@example.com"
    initial = (await client.post("/v1/auth/register", json={"name": "Farmer", "email": email, "password": old})).json()["tokens"]
    headers = {"Authorization": f"Bearer {initial['access_token']}"}
    change, refresh, login = await asyncio.gather(
        client.post("/v1/users/me/password", headers=headers, json={"current_password": old, "new_password": new}),
        client.post("/v1/auth/refresh", json={"refresh_token": initial["refresh_token"]}),
        client.post("/v1/auth/login", json={"email": email, "password": old}),
    )
    assert change.status_code == 204
    assert refresh.status_code in (200, 401)
    assert login.status_code in (200, 401)
    issued = [initial]
    if refresh.status_code == 200:
        issued.append(refresh.json())
    if login.status_code == 200:
        issued.append(login.json()["tokens"])
    for tokens in issued:
        assert (await client.get("/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})).status_code == 401
        assert (await client.post("/v1/auth/refresh", json={"refresh_token": tokens['refresh_token']})).status_code == 401


@pytest.mark.asyncio
async def test_concurrent_refresh_only_rotates_once(client):
    initial = (await client.post("/v1/auth/register", json={"name": "Farmer", "email": "refresh@example.com", "password": "old-password-123"})).json()["tokens"]
    responses = await asyncio.gather(*(client.post("/v1/auth/refresh", json={"refresh_token": initial["refresh_token"]}) for _ in range(2)))
    assert sorted(response.status_code for response in responses) == [200, 401]
