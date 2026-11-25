import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models import User
from app.models.entities import Payment, PaymentGrant

router = APIRouter(prefix="/payments", tags=["payments"])

class CreatePayment(BaseModel):
    client_id: UUID

class Notification(BaseModel):
    order_id: str
    status_code: str
    gross_amount: str
    signature_key: str

def configured():
    if not settings.midtrans_server_key or not settings.midtrans_signature_key:
        raise HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE")

async def midtrans_request(method, url, body=None):
    configured()
    try:
        async with httpx.AsyncClient(timeout=10, auth=(settings.midtrans_server_key, ""), follow_redirects=False) as client:
            response = await client.request(method, url, json=body)
            if method == "GET" and response.status_code == 404:
                return None
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict):
                raise ValueError()
            return result
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE") from None

def serialize(p):
    return {"order_id": p.order_id, "client_id": str(p.client_id), "status": p.status,
            "redirect_url": p.redirect_url, "granted_until": p.granted_until.isoformat() if p.granted_until else None}

@router.post("")
async def create_payment(payload: CreatePayment, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    configured()
    # Serialize idempotency by user, including concurrent first requests.
    await db.execute(update(User).where(User.id == user.id).values(id=User.id, updated_at=User.updated_at))
    payment = await db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.client_id == payload.client_id))
    if payment is None:
        unresolved = await db.scalar(select(Payment.id).where(
            Payment.user_id == user.id,
            Payment.status.in_(["created", "checkout_uncertain", "pending"]),
        ).limit(1))
        if unresolved is not None:
            raise HTTPException(409, "PAYMENT_CHECKOUT_UNRESOLVED")
        payment = Payment(user_id=user.id, client_id=payload.client_id, order_id=str(uuid4()), status="created")
        db.add(payment)
        await db.commit()
        # Persist the order before contacting Midtrans so timeouts cannot create
        # a new order on retry. Reacquire the user lock before checkout.
        await db.execute(update(User).where(User.id == user.id).values(id=User.id, updated_at=User.updated_at))
        payment = await db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.client_id == payload.client_id).execution_options(populate_existing=True))
        if payment is None:
            raise HTTPException(404, "RESOURCE_NOT_FOUND")
    if not payment.redirect_url:
        if payment.status != "created":
            raise HTTPException(503, "PAYMENT_CHECKOUT_UNCERTAIN")
        # Persist intent before the provider call. A crash or timeout is ambiguous;
        # never issue another Snap request for this order automatically.
        payment.status = "checkout_uncertain"
        await db.commit()
        await db.execute(update(User).where(User.id == user.id).values(id=User.id, updated_at=User.updated_at))
        payment = await db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.client_id == payload.client_id).execution_options(populate_existing=True))
        if payment is None:
            raise HTTPException(404, "RESOURCE_NOT_FOUND")
        if payment.status != "checkout_uncertain":
            await db.commit()
            return serialize(payment)
        result = await midtrans_request("POST", "https://app.sandbox.midtrans.com/snap/v1/transactions", {
            "transaction_details": {"order_id": payment.order_id, "gross_amount": 25000},
            "item_details": [{"id": "pro-30d", "price": 25000, "quantity": 1, "name": "Pro 30 days"}],
        })
        url = result.get("redirect_url")
        if not isinstance(url, str) or not url.startswith("https://app.sandbox.midtrans.com/"):
            raise HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE")
        payment.redirect_url = url
        payment.status = "pending"
    await db.commit()
    return serialize(payment)

async def reconcile(order_id, db, owner=None, allow_unstarted=False):
    configured()
    payment = await db.scalar(select(Payment).where(Payment.order_id == order_id))
    if payment is None or (owner is not None and payment.user_id != owner):
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    # Serialize provider reads and their resulting updates on the user row.
    await db.execute(update(User).where(User.id == payment.user_id).values(id=User.id, updated_at=User.updated_at))
    payment = await db.scalar(select(Payment).where(Payment.order_id == order_id).execution_options(populate_existing=True))
    if payment is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    result = await midtrans_request("GET", f"https://api.sandbox.midtrans.com/v2/{payment.order_id}/status")
    if result is None:
        if allow_unstarted and payment.granted_until is None and (
            payment.status in {"checkout_uncertain", "pending"}
        ):
            return payment
        raise HTTPException(503, "PAYMENT_SERVICE_UNAVAILABLE")
    try:
        if result.get("order_id") != order_id or Decimal(str(result.get("gross_amount"))) != Decimal("25000"):
            raise ValueError()
        state = result["transaction_status"]
        if not isinstance(state, str) or state not in {"pending", "settlement", "capture", "deny", "cancel", "expire", "failure", "refund", "partial_refund", "chargeback", "partial_chargeback"}:
            raise ValueError()
        if state in {"capture", "settlement"} and (
            result.get("status_code") != "200"
            or ("fraud_status" in result and result["fraud_status"] != "accept")
        ):
            raise ValueError()
    except (InvalidOperation, ValueError, KeyError):
        raise HTTPException(503, "PAYMENT_STATUS_INVALID") from None
    user = await db.scalar(select(User).where(User.id == payment.user_id).execution_options(populate_existing=True))
    now = datetime.now(timezone.utc)
    def aware(value):
        return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value

    grants = list((await db.scalars(select(PaymentGrant).where(PaymentGrant.user_id == user.id).order_by(PaymentGrant.starts_at, PaymentGrant.payment_id))).all())
    grant = next((g for g in grants if g.payment_id == payment.id), None)
    revoked_states = {"refund", "partial_refund", "chargeback", "partial_chargeback", "cancel", "deny"}
    if state in revoked_states and payment.granted_until and grant is None:
        # Pre-ledger grants have unknown provenance: do not erase legacy access.
        raise HTTPException(503, "PAYMENT_LEGACY_GRANT_REVIEW_REQUIRED")
    if grant is None and payment.granted_until is None and state in {"settlement", "capture"} and payment.status not in revoked_states:
        if not grants and user.entitlement_baseline_at is None:
            user.entitlement_baseline_at = user.pro_expires_at
        start = max(now, aware(user.pro_expires_at) or now)
        grant = PaymentGrant(payment_id=payment.id, user_id=user.id, starts_at=start, ends_at=start + timedelta(days=30))
        db.add(grant)
        user.pro_expires_at = grant.ends_at
        user.plan = "pro"
        payment.granted_until = grant.ends_at
    elif grant and grant.revoked_at is None and state in revoked_states:
        # Only the unconsumed part is removable. Shift later prepaid intervals
        # into the resulting gap, never into already consumed time.
        start, end = aware(grant.starts_at), aware(grant.ends_at)
        removed = max(end - max(start, now), timedelta(0))
        grant.revoked_at = now
        gap_start, gap_end = end - removed, end
        for later in grants:
            if later is grant or later.revoked_at is not None or aware(later.starts_at) < end:
                continue
            later_start, later_end = aware(later.starts_at), aware(later.ends_at)
            shift = max(gap_end - max(gap_start, later_start - removed), timedelta(0))
            later.starts_at = later_start - shift
            later.ends_at = later_end - shift
            gap_start, gap_end = later_end - shift, later_end
            removed = shift
        expiry = aware(user.pro_expires_at)
        baseline = aware(user.entitlement_baseline_at)
        if expiry:
            user.pro_expires_at = max(expiry - removed, baseline or now, now) if removed else expiry
    # Revocations are terminal: a stale provider response cannot re-grant.
    if payment.status not in revoked_states and (not payment.granted_until or state not in {"pending", "expire", "failure"}):
        payment.status = state
    await db.commit()
    return payment

@router.post("/webhook")
async def webhook(payload: Notification, db: AsyncSession = Depends(get_db)):
    configured()
    expected = hashlib.sha512((payload.order_id + payload.status_code + payload.gross_amount + settings.midtrans_signature_key).encode()).hexdigest()
    if not hmac.compare_digest(expected.encode("ascii"), payload.signature_key.encode("utf-8")):
        raise HTTPException(401, "INVALID_SIGNATURE")
    await reconcile(payload.order_id, db)
    return {"ok": True}

@router.get("")
async def history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    payments = (await db.scalars(select(Payment).where(Payment.user_id == user.id).order_by(Payment.created_at.desc()))).all()
    return {"items": [serialize(p) for p in payments]}

@router.post("/recover")
async def recover_payment(payload: CreatePayment, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    payment = await db.scalar(select(Payment).where(Payment.user_id == user.id, Payment.client_id == payload.client_id))
    if payment is None:
        raise HTTPException(404, "RESOURCE_NOT_FOUND")
    return serialize(await reconcile(payment.order_id, db, user.id, allow_unstarted=True))


@router.get("/{order_id}")
async def payment_status(order_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return serialize(await reconcile(order_id, db, user.id, allow_unstarted=True))
