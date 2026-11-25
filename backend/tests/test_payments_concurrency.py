import asyncio
import os
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api import payments
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models import User
from app.models.entities import Payment


@pytest_asyncio.fixture
async def payment_pg(monkeypatch):
    url = os.environ.get('DISPOSABLE_PAYMENT_TEST_DATABASE_URL')
    if not url:
        pytest.skip('requires dedicated disposable PostgreSQL database')
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        user = User(id=uuid.uuid4(), name='Farmer', email='pg-payment@example.com', password_hash='unused')
        db.add(user)
        await db.flush()
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id='ordering', status='pending'))
        await db.commit()
    async def override():
        async with sessions() as db:
            yield db
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    monkeypatch.setattr(settings, 'midtrans_server_key', 'test')
    monkeypatch.setattr(settings, 'midtrans_signature_key', 'test')
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test', headers={'Authorization': f'Bearer {create_access_token(str(user.id))}'}) as client:
            yield client, sessions
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()


@pytest.mark.asyncio
async def test_provider_status_is_fetched_in_user_lock(payment_pg, monkeypatch):
    client, sessions = payment_pg
    first_entered = asyncio.Event()
    release = asyncio.Event()
    calls = 0
    async def request(method, url, body=None):
        nonlocal calls
        calls += 1
        n = calls
        if n == 1:
            first_entered.set()
            await release.wait()
        return {'order_id': 'ordering', 'gross_amount': '25000', 'transaction_status': 'pending' if n == 1 else 'settlement', 'status_code': '200'}
    monkeypatch.setattr(payments, 'midtrans_request', request)
    first = asyncio.create_task(client.get('/v1/payments/ordering'))
    await asyncio.wait_for(first_entered.wait(), 5)
    second = asyncio.create_task(client.get('/v1/payments/ordering'))
    await asyncio.sleep(.3)
    calls_before_release = calls
    release.set()
    responses = await asyncio.wait_for(asyncio.gather(first, second), 5)
    assert all(r.status_code == 200 for r in responses)
    assert calls_before_release == 1
    async with sessions() as db:
        assert (await db.scalar(select(Payment))).status == 'settlement'


@pytest.mark.asyncio
async def test_concurrent_checkout_only_sends_one_request(payment_pg, monkeypatch):
    client, sessions = payment_pg
    entered = asyncio.Event()
    release = asyncio.Event()
    calls = 0
    async def request(method, url, body=None):
        nonlocal calls
        calls += 1
        entered.set()
        await release.wait()
        return {"redirect_url": "https://app.sandbox.midtrans.com/snap/v2/test"}
    monkeypatch.setattr(payments, 'midtrans_request', request)
    client_id = str(uuid.uuid4())
    first = asyncio.create_task(client.post('/v1/payments', json={'client_id': client_id}))
    await asyncio.wait_for(entered.wait(), 5)
    second = asyncio.create_task(client.post('/v1/payments', json={'client_id': client_id}))
    await asyncio.sleep(.3)
    release.set()
    responses = await asyncio.wait_for(asyncio.gather(first, second), 5)
    assert all(r.status_code == 200 for r in responses)
    assert calls == 1
    assert responses[0].json()['order_id'] == responses[1].json()['order_id']


@pytest.mark.asyncio
async def test_duplicate_webhooks_grant_once(payment_pg, monkeypatch):
    import hashlib
    client, sessions = payment_pg
    async def request(method, url, body=None):
        return {'order_id': 'ordering', 'gross_amount': '25000', 'transaction_status': 'settlement', 'status_code': '200'}
    monkeypatch.setattr(payments, 'midtrans_request', request)
    signature = hashlib.sha512(b'ordering20025000test').hexdigest()
    payload = {'order_id': 'ordering', 'status_code': '200', 'gross_amount': '25000', 'signature_key': signature}
    results = await asyncio.gather(*(client.post('/v1/payments/webhook', json=payload) for _ in range(2)))
    assert all(r.status_code == 200 for r in results)
    async with sessions() as db:
        user = await db.scalar(select(User))
        payment = await db.scalar(select(Payment))
        assert user.pro_expires_at == payment.granted_until


@pytest.mark.asyncio
async def test_concurrent_refund_and_duplicate_refund_revoke_once(payment_pg, monkeypatch):
    from app.models.entities import PaymentGrant
    client, sessions = payment_pg
    state = 'settlement'
    async def request(method, url, body=None):
        return {'order_id': 'ordering', 'gross_amount': '25000', 'transaction_status': state, 'status_code': '200'}
    monkeypatch.setattr(payments, 'midtrans_request', request)
    assert (await client.get('/v1/payments/ordering')).status_code == 200
    state = 'refund'
    results = await asyncio.gather(*(client.get('/v1/payments/ordering') for _ in range(2)))
    assert all(response.status_code == 200 for response in results)
    async with sessions() as db:
        user = await db.scalar(select(User))
        grant = await db.scalar(select(PaymentGrant))
        assert grant.revoked_at is not None
        assert user.pro_expires_at == grant.revoked_at
