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

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        async with sessions() as session:
            yield session

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
            yield test_client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        await engine.dispose()


@pytest.mark.asyncio
async def test_password_change_strips_whitespace_consistently_with_login(client: AsyncClient):
    email = "farmer@example.com"
    old_password = "old-password-123"
    new_password = "new-password-456"
    registration = await client.post("/v1/auth/register", json={"name": "Farmer", "email": email, "password": old_password})
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['tokens']['access_token']}"}
    changed = await client.post("/v1/users/me/password", headers=headers, json={"current_password": f"  {old_password}  ", "new_password": f"  {new_password}  "})
    assert changed.status_code == 204
    assert (await client.post("/v1/auth/login", json={"email": email, "password": old_password})).status_code == 401
    assert (await client.post("/v1/auth/login", json={"email": email, "password": new_password})).status_code == 200


@pytest.mark.asyncio
async def test_password_change_requires_authentication(client: AsyncClient):
    response = await client.post("/v1/users/me/password", json={"current_password": "old-password-123", "new_password": "new-password-456"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_wrong_current_password_does_not_change_password(client: AsyncClient):
    email, password = "farmer@example.com", "old-password-123"
    registration = await client.post("/v1/auth/register", json={"name": "Farmer", "email": email, "password": password})
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['tokens']['access_token']}"}
    response = await client.post("/v1/users/me/password", headers=headers, json={"current_password": "wrong", "new_password": "new-password-456"})
    assert response.status_code == 400
    assert response.json()["detail"] == "CURRENT_PASSWORD_INVALID"
    assert (await client.post("/v1/auth/login", json={"email": email, "password": password})).status_code == 200
    assert (await client.post("/v1/auth/login", json={"email": email, "password": "new-password-456"})).status_code == 401


@pytest.mark.asyncio
@pytest.mark.parametrize("new_password,expected", [
    ("a" * 11, 422),
    (" " + "a" * 11 + " ", 422),
    ("a" * 12, 204),
    ("a" * 128, 204),
    ("a" * 129, 422),
    (" " * 12, 422),
])
async def test_new_password_length_after_trimming(client: AsyncClient, new_password: str, expected: int):
    registration = await client.post("/v1/auth/register", json={"name": "Farmer", "email": "farmer@example.com", "password": "old-password-123"})
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['tokens']['access_token']}"}
    response = await client.post("/v1/users/me/password", headers=headers, json={"current_password": "old-password-123", "new_password": new_password})
    assert response.status_code == expected


@pytest.mark.asyncio
@pytest.mark.parametrize("current_password", ["", "   ", "x" * 129])
async def test_current_password_length_after_trimming(client: AsyncClient, current_password: str):
    registration = await client.post("/v1/auth/register", json={"name": "Farmer", "email": "farmer@example.com", "password": "old-password-123"})
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['tokens']['access_token']}"}
    response = await client.post("/v1/users/me/password", headers=headers, json={"current_password": current_password, "new_password": "new-password-456"})
    assert response.status_code == 422
