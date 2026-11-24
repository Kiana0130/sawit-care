from datetime import date, datetime, timedelta, timezone
from io import BytesIO
import os
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models import DailyScanUsage, Scan, User

router = APIRouter(prefix="/scans", tags=["scans"])
dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])
SCAN_STORAGE_DIR = Path(os.getenv("SCAN_STORAGE_DIR", str(Path(__file__).resolve().parents[2] / "uploads" / "scans")))
ALLOWED_CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_IMAGE_SIDE = 2048
WITA = ZoneInfo("Asia/Makassar")


def serialize_scan(scan: Scan) -> dict:
    return {
        "id": str(scan.id), "client_id": str(scan.client_id), "status": scan.status,
        "disease": None, "confidence": None, "image_url": None,
        "scanned_at": scan.scanned_at.isoformat(),
    }


def _wita_today(now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(WITA).date()


async def _read_and_validate_image(image: UploadFile) -> bytes:
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="IMAGE_NOT_VALID")
    data = await image.read(MAX_FILE_SIZE + 1)
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="FILE_TOO_LARGE")
    try:
        from PIL import Image, UnidentifiedImageError
        with Image.open(BytesIO(data)) as decoded:
            decoded.verify()
        with Image.open(BytesIO(data)) as decoded:
            if decoded.format not in {"JPEG", "PNG", "WEBP"} or max(decoded.size) > MAX_IMAGE_SIDE:
                raise HTTPException(status_code=422, detail="IMAGE_NOT_VALID")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=422, detail="IMAGE_NOT_VALID") from None
    return data


async def _usage_for_today(session: AsyncSession, user: User) -> DailyScanUsage:
    today = _wita_today()
    usage = await session.scalar(select(DailyScanUsage).where(
        DailyScanUsage.user_id == user.id, DailyScanUsage.usage_date == today,
    ))
    if usage is None:
        usage = DailyScanUsage(user_id=user.id, usage_date=today, scan_count=0)
        session.add(usage)
    return usage


@dashboard_router.get("/summary")
async def dashboard_summary(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db),
):
    query = select(Scan).where(Scan.user_id == current_user.id)
    if current_user.plan != "pro":
        query = query.where(Scan.scanned_at >= datetime.now(timezone.utc) - timedelta(days=7))
    scans = list((await session.scalars(query)).all())
    return {
        "total_scans": len(scans),
        "healthy_scans": sum(scan.status == "healthy" for scan in scans),
        "sick_scans": sum(scan.status == "sick" for scan in scans),
        "pending_scans": sum(scan.status == "pending" for scan in scans),
        "sick_tree_count": 0,
        "last_updated_at": max((scan.scanned_at for scan in scans), default=None),
    }


@router.get("/quota")
async def get_scan_quota(
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db),
):
    usage = await _usage_for_today(session, current_user)
    await session.commit()
    await session.refresh(usage)
    limit = None if current_user.plan == "pro" else 5
    return {
        "date": _wita_today().isoformat(), "plan": current_user.plan,
        "limit": limit, "used": usage.scan_count,
        "remaining": None if limit is None else max(0, limit - usage.scan_count),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scan(
    client_id: UUID = Form(...), image: UploadFile = File(...),
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db),
):
    usage = await _usage_for_today(session, current_user)
    existing = await session.scalar(select(Scan).where(
        Scan.user_id == current_user.id, Scan.client_id == client_id,
    ))
    if existing:
        return serialize_scan(existing)
    image_data = await _read_and_validate_image(image)
    if current_user.plan != "pro" and usage.scan_count >= 5:
        raise HTTPException(status_code=429, detail="SCAN_QUOTA_EXCEEDED")
    extension = ALLOWED_CONTENT_TYPES.get(image.content_type)
    if extension is None:
        raise HTTPException(status_code=422, detail="IMAGE_NOT_VALID")
    scan_id = uuid4()
    storage_dir = SCAN_STORAGE_DIR / str(current_user.id)
    storage_dir.mkdir(parents=True, exist_ok=True)
    image_path = storage_dir / f"{scan_id}.{extension}"
    image_path.write_bytes(image_data)
    scan = Scan(
        id=scan_id, client_id=client_id, user_id=current_user.id,
        image_object_key=str(image_path), status="pending", scanned_at=datetime.now(timezone.utc),
    )
    session.add(scan)
    try:
        await session.flush()
        usage.scan_count += 1
        await session.commit()
    except Exception:
        await session.rollback()
        image_path.unlink(missing_ok=True)
        raise
    await session.refresh(scan)
    return serialize_scan(scan)


@router.get("")
async def list_scans(
    status_filter: str = Query("all", alias="status", pattern="^(all|healthy|sick|pending)$"),
    sort: str = Query("latest", pattern="^(latest|oldest)$"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user), session: AsyncSession = Depends(get_db),
):
    query = select(Scan).where(Scan.user_id == current_user.id)
    if current_user.plan != "pro":
        query = query.where(Scan.scanned_at >= datetime.now(timezone.utc) - timedelta(days=7))
    if status_filter == "healthy":
        query = query.where(Scan.status == "healthy")
    elif status_filter == "sick":
        query = query.where(Scan.status == "sick")
    elif status_filter == "pending":
        query = query.where(Scan.status == "pending")
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    order = Scan.scanned_at.desc() if sort == "latest" else Scan.scanned_at.asc()
    items = list((await session.scalars(query.order_by(order).offset((page - 1) * page_size).limit(page_size))).all())
    return {"items": [serialize_scan(scan) for scan in items], "page": page,
            "page_size": page_size, "total": total, "has_more": page * page_size < total}


@router.get("/{scan_id}")
async def get_scan(
    scan_id: UUID, current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == current_user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="RESOURCE_NOT_FOUND")
    return serialize_scan(scan)


@router.get("/{scan_id}/photo")
async def get_scan_photo(
    scan_id: UUID, current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == current_user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="RESOURCE_NOT_FOUND")
    image_path = Path(scan.image_object_key)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="RESOURCE_NOT_FOUND")
    from fastapi.responses import FileResponse
    mime_type = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(image_path.suffix.lower(), "application/octet-stream")
    return FileResponse(image_path, media_type=mime_type, filename=image_path.name)


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scan(
    scan_id: UUID, current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    scan = await session.scalar(select(Scan).where(Scan.id == scan_id, Scan.user_id == current_user.id))
    if scan is None:
        raise HTTPException(status_code=404, detail="RESOURCE_NOT_FOUND")
    image_path = Path(scan.image_object_key)
    await session.delete(scan)
    await session.commit()
    image_path.unlink(missing_ok=True)
