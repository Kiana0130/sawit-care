from collections.abc import AsyncGenerator
from datetime import date, datetime, timezone
import os
import uuid
from io import BytesIO
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
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
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


def make_jpeg() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color=(30, 140, 30)).save(buffer, format="JPEG")
    return buffer.getvalue()


def request_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def image_upload(client_id: str, image: bytes | None = None):
    return {"client_id": client_id}, {"image": ("leaf.jpg", image if image is not None else make_jpeg(), "image/jpeg")}


@pytest_asyncio.fixture
async def scan_user(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from app.api import scans as scan_api
    monkeypatch.setattr(scan_api, "SCAN_STORAGE_DIR", tmp_path)
    user = User(id=uuid.uuid4(), name="Test Farmer", email=f"farmer-{uuid.uuid4()}@example.com", password_hash="not-used", plan="free")
    async with SessionLocal() as session:
        session.add(user)
        await session.commit()
    return user, create_access_token(str(user.id))


@pytest.mark.asyncio
async def test_scan_requires_authentication():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data, files = image_upload(str(uuid.uuid4()))
        response = await client.post("/v1/scans", data=data, files=files)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_upload_does_not_consume_daily_quota(scan_user):
    _, token = scan_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data, files = image_upload(str(uuid.uuid4()), b"not-image")
        response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
        assert response.status_code == 422
        quota = await client.get("/v1/scans/quota", headers=request_headers(token))
    assert quota.json()["used"] == 0


@pytest.mark.asyncio
async def test_upload_creates_pending_history_and_quota(scan_user):
    _, token = scan_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data, files = image_upload(str(uuid.uuid4()))
        response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
        assert response.status_code == 201
        scan = response.json()
        assert scan["status"] == "pending"
        assert scan["disease"] is None
        assert scan["confidence"] is None
        history = await client.get("/v1/scans?status=all&page=1&page_size=20&sort=latest", headers=request_headers(token))
        assert history.json()["total"] == 1
        quota = await client.get("/v1/scans/quota", headers=request_headers(token))
    assert history.json()["items"][0]["id"] == scan["id"]
    assert quota.json()["used"] == 1
    assert quota.json()["remaining"] == 4


@pytest.mark.asyncio
async def test_duplicate_client_id_does_not_count_twice(scan_user):
    _, token = scan_user
    client_id = str(uuid.uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(2):
            data, files = image_upload(client_id)
            response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
            assert response.status_code in {200, 201}
        quota = await client.get("/v1/scans/quota", headers=request_headers(token))
    assert quota.json()["used"] == 1


@pytest.mark.asyncio
async def test_free_plan_is_blocked_after_five_valid_scans(scan_user):
    _, token = scan_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(5):
            data, files = image_upload(str(uuid.uuid4()))
            response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
            assert response.status_code == 201
        data, files = image_upload(str(uuid.uuid4()))
        blocked = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
    assert blocked.status_code == 429
    assert blocked.json()["detail"] == "SCAN_QUOTA_EXCEEDED"


@pytest.mark.asyncio
async def test_history_detail_delete_dashboard_and_owner_scope(scan_user):
    user, token = scan_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        data, files = image_upload(str(uuid.uuid4()))
        response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
        scan_id = response.json()["id"]
        dashboard = await client.get("/v1/dashboard/summary", headers=request_headers(token))
        assert dashboard.status_code == 200
        assert dashboard.json()["total_scans"] == 1
        assert dashboard.json()["pending_scans"] == 1
        detail = await client.get(f"/v1/scans/{scan_id}", headers=request_headers(token))
        assert detail.status_code == 200
        photo = await client.get(f"/v1/scans/{scan_id}/photo", headers=request_headers(token))
        assert photo.status_code == 200
        assert photo.headers["content-type"] == "image/jpeg"
        other_token = create_access_token(str(uuid.uuid4()))
        assert (await client.get(f"/v1/scans/{scan_id}", headers=request_headers(other_token))).status_code == 401
        assert (await client.delete(f"/v1/scans/{scan_id}", headers=request_headers(token))).status_code == 204
        assert (await client.get(f"/v1/scans/{scan_id}", headers=request_headers(token))).status_code == 404
        quota = await client.get("/v1/scans/quota", headers=request_headers(token))
    assert quota.json()["used"] == 1


@pytest.mark.asyncio
async def test_pro_user_does_not_have_free_scan_limit(scan_user):
    user, token = scan_user
    async with SessionLocal() as session:
        stored_user = await session.get(User, user.id)
        assert stored_user is not None
        stored_user.plan = "pro"
        await session.commit()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(6):
            data, files = image_upload(str(uuid.uuid4()))
            response = await client.post("/v1/scans", headers=request_headers(token), data=data, files=files)
            assert response.status_code == 201
        quota = await client.get("/v1/scans/quota", headers=request_headers(token))
    assert quota.json()["limit"] is None
    assert quota.json()["remaining"] is None
