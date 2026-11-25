import asyncio
import os
import uuid
from io import BytesIO

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import scans
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models import DailyScanUsage, Scan, User


@pytest_asyncio.fixture
async def concurrent_client(tmp_path, monkeypatch):
    # Isolate PostgreSQL tables in a fresh schema; never drop pre-existing tables.
    url = os.environ.get("SCAN_CONCURRENCY_TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    schema = f"scan_test_{uuid.uuid4().hex}"
    admin = None
    if url.startswith("postgresql+asyncpg://"):
        admin = create_async_engine(url)
        async with admin.begin() as conn:
            await conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
    elif url.startswith("sqlite+aiosqlite:///") and url.endswith(str(tmp_path / "test.db")):
        engine = create_async_engine(url)
    else:
        raise ValueError("Expected the temporary SQLite database or an asyncpg test database")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    user = User(id=uuid.uuid4(), name="Test", email=f"{uuid.uuid4()}@example.com", password_hash="unused", plan="free")
    async with sessions() as session:
        session.add(user)
        await session.commit()
    async def override():
        async with sessions() as session:
            yield session
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    monkeypatch.setattr(scans, "SCAN_STORAGE_DIR", tmp_path / "uploads")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client, sessions, user, tmp_path
    if previous is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous
    await engine.dispose()
    if admin is not None:
        async with admin.begin() as conn:
            await conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        await admin.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("duplicate", [False, True])
async def test_concurrent_uploads_enforce_quota_and_idempotency(concurrent_client, duplicate):
    client, sessions, user, tmp_path = concurrent_client
    token = create_access_token(str(user.id))
    output = BytesIO()
    Image.new("RGB", (8, 8)).save(output, format="JPEG")
    image = output.getvalue()
    shared_id = str(uuid.uuid4())
    async def upload():
        return await client.post("/v1/scans", headers={"Authorization": f"Bearer {token}"},
            data={"client_id": shared_id if duplicate else str(uuid.uuid4())},
            files={"image": ("leaf.jpg", image, "image/jpeg")})
    responses = await asyncio.gather(*(upload() for _ in range(8)))
    expected = 1 if duplicate else 5
    assert sum(response.status_code == 201 for response in responses) == (8 if duplicate else 5)
    assert all(response.status_code == 201 for response in responses) if duplicate else all(response.status_code in (201, 429) for response in responses)
    if duplicate:
        assert len({response.json()["id"] for response in responses}) == 1
    async with sessions() as session:
        assert await session.scalar(select(func.count()).select_from(Scan)) == expected
        assert (await session.scalar(select(DailyScanUsage))).scan_count == expected
    assert len(list((tmp_path / "uploads").rglob("*.jpg"))) == expected
