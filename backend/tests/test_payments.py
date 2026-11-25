import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.main import app
from app.models import User


@pytest_asyncio.fixture
async def payment_client(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'payments.db'}")
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with sessions() as session:
        user = User(id=uuid.uuid4(), name="Farmer", email="farmer@example.com", password_hash="unused", plan="free")
        session.add(user)
        await session.commit()
    async def override():
        async with sessions() as session:
            yield session
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"Authorization": f"Bearer {create_access_token(str(user.id))}"}) as client:
            yield client, sessions
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        await engine.dispose()


@pytest.mark.asyncio
async def test_payment_creation_fails_closed_without_sandbox_credentials(payment_client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "")
    monkeypatch.setattr(settings, "midtrans_signature_key", "")
    client, _ = payment_client
    response = await client.post('/v1/payments', json={'client_id': str(uuid.uuid4())})
    assert response.status_code == 503
    assert response.json()['detail'] == 'PAYMENT_SERVICE_UNAVAILABLE'


@pytest.mark.asyncio
async def test_expired_legacy_pro_has_no_entitlement(payment_client):
    client, sessions = payment_client
    async with sessions() as session:
        from sqlalchemy import select
        user = await session.scalar(select(User))
        user.plan = "pro"
        await session.commit()
    assert (await client.get("/v1/users/me")).json()["plan"] == "free"
    assert (await client.get("/v1/scans/quota")).json()["limit"] == 5


@pytest.mark.asyncio
async def test_checkout_and_reconciliation_grants_once(payment_client, monkeypatch):
    import hashlib
    import httpx
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test", raising=False)
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test", raising=False)
    original_send = httpx.AsyncClient.send
    async def send(self, request, **kwargs):
        if request.url.host not in {"app.sandbox.midtrans.com", "api.sandbox.midtrans.com"}:
            return await original_send(self, request, **kwargs)
        if request.method == "POST":
            return httpx.Response(201, json={"token": "token", "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/test"}, request=request)
        order = request.url.path.split("/")[-2]
        return httpx.Response(200, json={"order_id": order, "gross_amount": "25000.00", "transaction_status": "settlement", "status_code": "200"}, request=request)
    monkeypatch.setattr(httpx.AsyncClient, "send", send)
    client, _ = payment_client
    response = await client.post("/v1/payments", json={"client_id": str(uuid.uuid4())})
    assert response.status_code == 200
    order = response.json()["order_id"]
    sig = hashlib.sha512((order + "200" + "25000.00" + "signature-test").encode()).hexdigest()
    payload = {"order_id": order, "status_code": "200", "gross_amount": "25000.00", "signature_key": sig}
    assert (await client.post("/v1/payments/webhook", json=payload)).status_code == 200
    first = (await client.get(f"/v1/payments/{order}")).json()
    assert first["status"] == "settlement"
    assert (await client.get("/v1/users/me")).json()["plan"] == "pro"
    assert (await client.post("/v1/payments/webhook", json=payload)).status_code == 200
    assert (await client.get(f"/v1/payments/{order}")).json()["granted_until"] == first["granted_until"]


@pytest.mark.asyncio
async def test_invalid_signature_never_calls_gateway(payment_client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test")
    client, _ = payment_client
    response = await client.post("/v1/payments/webhook", json={"order_id": "x", "status_code": "200", "gross_amount": "25000.00", "signature_key": "bad"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_owner_cannot_reconcile_another_users_order(payment_client, monkeypatch):
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test")
    client, sessions = payment_client
    async with sessions() as session:
        other = User(id=uuid.uuid4(), name="Other", email="other@example.com", password_hash="unused")
        session.add(other)
        session.add(Payment(user_id=other.id, client_id=uuid.uuid4(), order_id="other-order", status="pending"))
        await session.commit()
    assert (await client.get("/v1/payments/other-order")).status_code == 404


@pytest.mark.asyncio
async def test_checkout_timeout_does_not_retry_ambiguous_provider_request(payment_client, monkeypatch):
    import httpx
    import json
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test")
    original = httpx.AsyncClient.send
    seen = []
    async def send(self, request, **kwargs):
        if request.url.host != "app.sandbox.midtrans.com":
            return await original(self, request, **kwargs)
        seen.append(json.loads(request.content)["transaction_details"]["order_id"])
        raise httpx.ReadTimeout("test", request=request)
    monkeypatch.setattr(httpx.AsyncClient, "send", send)
    client, _ = payment_client
    client_id = str(uuid.uuid4())
    for _ in range(2):
        assert (await client.post("/v1/payments", json={"client_id": client_id})).status_code == 503
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_snap_checkout_before_payment_selection_returns_pending_on_provider_404(payment_client, monkeypatch):
    import httpx
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test")
    client, sessions = payment_client
    async with sessions() as session:
        from sqlalchemy import select
        user = await session.scalar(select(User))
        session.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="pending-order", status="pending", redirect_url="https://app.sandbox.midtrans.com/snap/v2/test"))
        await session.commit()
    original = httpx.AsyncClient.send
    async def send(self, request, **kwargs):
        if request.url.host == "api.sandbox.midtrans.com":
            return httpx.Response(404, json={"status_code": "404", "status_message": "The requested resource is not found"}, request=request)
        return await original(self, request, **kwargs)
    monkeypatch.setattr(httpx.AsyncClient, "send", send)
    response = await client.get("/v1/payments/pending-order")
    assert response.status_code == 200
    assert response.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_full_refund_removes_only_its_overlapping_grant(payment_client, monkeypatch):
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "sandbox-test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "signature-test")
    client, sessions = payment_client
    async with sessions() as session:
        user = await session.scalar(select(User))
        for order in ("order-one", "order-two"):
            session.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id=order, status="pending"))
        await session.commit()
    states = {"order-one": "settlement", "order-two": "settlement"}
    async def request(method, url, body=None):
        order = url.split("/")[-2]
        return {"order_id": order, "gross_amount": "25000.00", "transaction_status": states[order], "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    for order in states:
        assert (await client.get(f"/v1/payments/{order}")).status_code == 200
    async def expiry():
        async with sessions() as session:
            value = (await session.scalar(select(User))).pro_expires_at
            return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
    before = await expiry()
    states["order-one"] = "refund"
    assert (await client.get("/v1/payments/order-one")).status_code == 200
    after = await expiry()
    # A small amount of the first grant has already been consumed.
    assert timedelta(days=30, seconds=-5) < before - after <= timedelta(days=30)
    assert after > datetime.now(timezone.utc)
    assert (await client.get("/v1/payments/order-one")).status_code == 200
    assert await expiry() == after


@pytest.mark.asyncio
async def test_partial_refund_does_not_regrant_consumed_time_or_accept_stale_settlement(payment_client, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add_all([Payment(user_id=user.id, client_id=uuid.uuid4(), order_id=o, status="pending") for o in ("first", "second")])
        await db.commit()
    states = {"first": "settlement", "second": "settlement"}
    async def request(method, url, body=None):
        order = url.split("/")[-2]
        return {"order_id": order, "gross_amount": "25000", "transaction_status": states[order], "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    for order in states:
        assert (await client.get(f"/v1/payments/{order}")).status_code == 200
    async with sessions() as db:
        for grant in (await db.scalars(select(PaymentGrant))).all():
            grant.starts_at -= timedelta(days=10)
            grant.ends_at -= timedelta(days=10)
        user = await db.scalar(select(User))
        user.pro_expires_at -= timedelta(days=10)
        await db.commit()
    states["first"] = "partial_refund"
    assert (await client.get("/v1/payments/first")).status_code == 200
    async with sessions() as db:
        expiry = (await db.scalar(select(User))).pro_expires_at.replace(tzinfo=timezone.utc)
        assert timedelta(days=29, seconds=86390) < expiry - datetime.now(timezone.utc) < timedelta(days=30)
        assert sum(g.revoked_at is not None for g in (await db.scalars(select(PaymentGrant))).all()) == 1
    states["first"] = "settlement"
    response = await client.get("/v1/payments/first")
    assert response.json()["status"] == "partial_refund"
    async with sessions() as db:
        assert (await db.scalar(select(User))).pro_expires_at.replace(tzinfo=timezone.utc) == expiry


@pytest.mark.asyncio
async def test_refund_preserves_legacy_baseline(payment_client, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    baseline = datetime.now(timezone.utc) + timedelta(days=50)
    async with sessions() as db:
        user = await db.scalar(select(User))
        user.plan, user.pro_expires_at = "pro", baseline
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="legacy-baseline", status="pending"))
        await db.commit()
    state = "settlement"
    async def request(method, url, body=None):
        return {"order_id": "legacy-baseline", "gross_amount": "25000", "transaction_status": state, "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    assert (await client.get("/v1/payments/legacy-baseline")).status_code == 200
    state = "chargeback"
    assert (await client.get("/v1/payments/legacy-baseline")).status_code == 200
    async with sessions() as db:
        user = await db.scalar(select(User))
        assert user.pro_expires_at.replace(tzinfo=timezone.utc) == baseline
        assert user.entitlement_baseline_at.replace(tzinfo=timezone.utc) == baseline


@pytest.mark.asyncio
@pytest.mark.parametrize("state,code,fraud", [
    ("settlement", "202", "accept"),
    ("settlement", "200", "challenge"),
    ("capture", "202", "accept"),
    ("capture", "200", "challenge"),
    ("settlement", None, "accept"),
    ("settlement", 200, "accept"),
    ("capture", "200", None),
    ("settlement", "200", "deny"),
])
async def test_contradictory_success_never_grants(payment_client, monkeypatch, state, code, fraud):
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="invalid", status="pending"))
        await db.commit()
    async def request(method, url, body=None):
        return {"order_id": "invalid", "gross_amount": "25000.00", "transaction_status": state, "status_code": code, "fraud_status": fraud}
    monkeypatch.setattr(payments, "midtrans_request", request)
    response = await client.get("/v1/payments/invalid")
    assert response.status_code == 503
    assert response.json()["detail"] == "PAYMENT_STATUS_INVALID"
    async with sessions() as db:
        user = await db.scalar(select(User))
        assert user.plan == "free" and user.pro_expires_at is None
        assert await db.scalar(select(PaymentGrant)) is None
        assert (await db.scalar(select(Payment))).status == "pending"


@pytest.mark.asyncio
@pytest.mark.parametrize("state,fraud", [(s, f) for s in ("settlement", "capture") for f in ("accept", "absent")])
async def test_valid_provider_success_grants(payment_client, monkeypatch, state, fraud):
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="valid", status="pending"))
        await db.commit()
    async def request(method, url, body=None):
        result = {"order_id": "valid", "gross_amount": "25000.00", "transaction_status": state,
                  "status_code": "200", "payment_type": "credit_card" if state == "capture" else "bank_transfer",
                  "transaction_id": "example-id", "currency": "IDR", "status_message": "Success, transaction is found"}
        if fraud != "absent":
            result["fraud_status"] = fraud
        return result
    monkeypatch.setattr(payments, "midtrans_request", request)
    response = await client.get("/v1/payments/valid")
    assert response.status_code == 200
    assert response.json()["status"] == state
    async with sessions() as db:
        user = await db.scalar(select(User))
        assert user.plan == "pro" and user.pro_expires_at is not None
        assert await db.scalar(select(PaymentGrant)) is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("changes", [
    {"order_id": "wrong"}, {"gross_amount": "wrong"}, {"gross_amount": "24999"},
    {"transaction_status": "unknown"}, {"transaction_status": []},
    {"status_code": None}, {"fraud_status": {}},
])
async def test_invalid_provider_fields_never_grant(payment_client, monkeypatch, changes):
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="invalid-fields", status="pending"))
        await db.commit()
    async def request(method, url, body=None):
        return {"order_id": "invalid-fields", "gross_amount": "25000.00", "transaction_status": "settlement", "status_code": "200", **changes}
    monkeypatch.setattr(payments, "midtrans_request", request)
    response = await client.get("/v1/payments/invalid-fields")
    assert response.status_code == 503
    assert response.json()["detail"] == "PAYMENT_STATUS_INVALID"
    async with sessions() as db:
        assert (await db.scalar(select(User))).pro_expires_at is None
        assert await db.scalar(select(PaymentGrant)) is None


@pytest.mark.asyncio
async def test_signed_webhook_rejects_contradictory_gateway_status(payment_client, monkeypatch):
    import hashlib
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="webhook-invalid", status="pending"))
        await db.commit()
    async def request(method, url, body=None):
        return {"order_id": "webhook-invalid", "gross_amount": "25000.00", "transaction_status": "settlement", "status_code": "202"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    signature = hashlib.sha512(b"webhook-invalid20025000.00test").hexdigest()
    response = await client.post("/v1/payments/webhook", json={"order_id": "webhook-invalid", "status_code": "200", "gross_amount": "25000.00", "signature_key": signature})
    assert response.status_code == 503
    assert response.json()["detail"] == "PAYMENT_STATUS_INVALID"
    async with sessions() as db:
        assert (await db.scalar(select(User))).pro_expires_at is None
        assert await db.scalar(select(PaymentGrant)) is None


@pytest.mark.asyncio
async def test_recover_timeout_checks_status_without_reposting_or_treating_404_as_absent(payment_client, monkeypatch):
    from app.api import payments
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    calls = []
    state = None
    async def request(method, url, body=None):
        calls.append(method)
        if method == "POST":
            raise payments.HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE")
        if state is None:
            return None
        return {"order_id": url.split("/")[-2], "gross_amount": "25000", "transaction_status": state, "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    client, _ = payment_client
    client_id = str(uuid.uuid4())
    assert (await client.post("/v1/payments", json={"client_id": client_id})).status_code == 503
    response = await client.post("/v1/payments/recover", json={"client_id": client_id})
    assert response.status_code == 200
    assert response.json()["status"] == "checkout_uncertain"
    state = "settlement"
    response = await client.post("/v1/payments/recover", json={"client_id": client_id})
    assert response.status_code == 200
    assert response.json()["status"] == "settlement"
    assert response.json()["granted_until"] is not None
    assert calls == ["POST", "GET", "GET"]


@pytest.mark.asyncio
async def test_new_client_id_cannot_bypass_uncertain_checkout(payment_client, monkeypatch):
    from app.api import payments
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    calls = []
    async def request(method, url, body=None):
        calls.append(method)
        raise payments.HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE")
    monkeypatch.setattr(payments, "midtrans_request", request)
    client, _ = payment_client
    assert (await client.post("/v1/payments", json={"client_id": str(uuid.uuid4())})).status_code == 503
    response = await client.post("/v1/payments", json={"client_id": str(uuid.uuid4())})
    assert response.status_code == 409
    assert response.json()["detail"] == "PAYMENT_CHECKOUT_UNRESOLVED"
    assert calls == ["POST"]


@pytest.mark.asyncio
async def test_recovery_pending_without_redirect_stays_blocked_on_later_404(payment_client, monkeypatch):
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment
    from sqlalchemy import select
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    client_id = uuid.uuid4()
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=client_id, order_id="recover-pending", status="checkout_uncertain"))
        await db.commit()
    state = "pending"
    async def request(method, url, body=None):
        if state is None:
            return None
        return {"order_id": "recover-pending", "gross_amount": "25000", "transaction_status": state, "status_code": "201"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    assert (await client.post("/v1/payments/recover", json={"client_id": str(client_id)})).json()["status"] == "pending"
    state = None
    response = await client.post("/v1/payments/recover", json={"client_id": str(client_id)})
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert (await client.post("/v1/payments", json={"client_id": str(uuid.uuid4())})).status_code == 409


@pytest.mark.asyncio
async def test_concurrent_takeover_of_created_payment_sends_one_snap_request(payment_client, monkeypatch):
    import asyncio
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    created = asyncio.Event()
    release = asyncio.Event()
    original_commit = AsyncSession.commit
    async def commit(session):
        first = any(isinstance(item, Payment) and item.status == "created" for item in session.new)
        await original_commit(session)
        if first:
            created.set()
            await release.wait()
    monkeypatch.setattr(AsyncSession, "commit", commit)
    calls = []
    async def request(method, url, body=None):
        calls.append(method)
        return {"redirect_url": "https://app.sandbox.midtrans.com/snap/v2/test"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    client, _ = payment_client
    client_id = str(uuid.uuid4())
    first = asyncio.create_task(client.post("/v1/payments", json={"client_id": client_id}))
    await asyncio.wait_for(created.wait(), 5)
    second = await client.post("/v1/payments", json={"client_id": client_id})
    release.set()
    response = await asyncio.wait_for(first, 5)
    assert second.status_code == 200 and response.status_code == 200
    assert calls == ["POST"]


@pytest.mark.asyncio
async def test_settlement_reversed_to_deny_revokes_grant_and_stale_success_cannot_regrant(payment_client, monkeypatch):
    from sqlalchemy import select
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment, PaymentGrant
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    client, sessions = payment_client
    async with sessions() as db:
        user = await db.scalar(select(User))
        db.add(Payment(user_id=user.id, client_id=uuid.uuid4(), order_id="reversal-deny", status="pending"))
        await db.commit()
    state = "settlement"
    async def request(method, url, body=None):
        return {"order_id": "reversal-deny", "gross_amount": "25000", "transaction_status": state, "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    assert (await client.get("/v1/payments/reversal-deny")).json()["status"] == "settlement"
    state = "deny"
    response = await client.get("/v1/payments/reversal-deny")
    assert response.json()["status"] == "deny"
    async with sessions() as db:
        grant = await db.scalar(select(PaymentGrant))
        assert grant.revoked_at is not None
        assert (await db.scalar(select(User))).pro_expires_at == grant.revoked_at
    state = "settlement"
    assert (await client.get("/v1/payments/reversal-deny")).json()["status"] == "deny"


@pytest.mark.asyncio
async def test_non_ascii_webhook_signature_is_rejected_without_gateway_call(payment_client, monkeypatch):
    from app.api import payments
    from app.core.config import settings
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    async def request(*args, **kwargs):
        pytest.fail("invalid signature reached gateway")
    monkeypatch.setattr(payments, "midtrans_request", request)
    client, _ = payment_client
    response = await client.post("/v1/payments/webhook", json={"order_id": "x", "status_code": "200", "gross_amount": "25000", "signature_key": "é"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_checkout_intent_recovered_before_sender_relocks_never_posts(payment_client, monkeypatch):
    import asyncio
    from sqlalchemy.ext.asyncio import AsyncSession
    from app.api import payments
    from app.core.config import settings
    from app.models.entities import Payment
    monkeypatch.setattr(settings, "midtrans_server_key", "test")
    monkeypatch.setattr(settings, "midtrans_signature_key", "test")
    committed, resume = asyncio.Event(), asyncio.Event()
    original_commit = AsyncSession.commit
    async def commit(db):
        pause = any(isinstance(item, Payment) and item.status == "checkout_uncertain" for item in db.dirty)
        await original_commit(db)
        if pause:
            committed.set()
            await resume.wait()
    monkeypatch.setattr(AsyncSession, "commit", commit)
    calls = []
    async def request(method, url, body=None):
        calls.append(method)
        if method == "POST":
            return {"redirect_url": "https://app.sandbox.midtrans.com/snap/v2/test"}
        return {"order_id": url.split("/")[-2], "gross_amount": "25000", "transaction_status": "settlement", "status_code": "200"}
    monkeypatch.setattr(payments, "midtrans_request", request)
    client, _ = payment_client
    client_id = str(uuid.uuid4())
    pending = asyncio.create_task(client.post("/v1/payments", json={"client_id": client_id}))
    try:
        await asyncio.wait_for(committed.wait(), 5)
        recovered = await client.post("/v1/payments/recover", json={"client_id": client_id})
        assert recovered.json()["status"] == "settlement"
    finally:
        resume.set()
    response = await asyncio.wait_for(pending, 5)
    assert response.json()["status"] == "settlement"
    assert calls == ["GET"]
