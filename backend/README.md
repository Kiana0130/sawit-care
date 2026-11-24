# Sawit Care API

Fondasi backend Prioritas 1 untuk Sawit Care.

## Stack

- FastAPI
- SQLAlchemy async
- PostgreSQL
- Alembic
- Uvicorn

## Menjalankan secara lokal

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Pastikan PostgreSQL tersedia dan database `sawitcare` sudah dibuat. Untuk PostgreSQL lokal via Compose (dari direktori `backend`), jalankan `docker compose up -d postgres`; service ini memakai kredensial development di `docker-compose.yml`. Atau gunakan PostgreSQL yang sudah tersedia. Sesuaikan `DATABASE_URL` di `.env`, lalu jalankan migration:

```bash
docker compose up -d postgres
docker compose ps
alembic upgrade head
uvicorn app.main:app --reload atau uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

API tersedia di `http://localhost:8000`.

- Health check: `GET /v1/health` (hanya proses API, bukan kesiapan database atau upload)
- OpenAPI: `http://localhost:8000/docs`
- Foto scan disimpan di `backend/uploads/scans` secara default, bukan MinIO; lindungi direktori dan backup bersama database. Lihat [panduan scan](SCAN-FEATURE.md) dan [kesiapan deployment](DEPLOYMENT.md).

`backend/uploads/` diabaikan Git hanya untuk file baru; file yang sudah terlacak tetap masuk commit. Tinjau `git ls-files backend/uploads/` sebelum berbagi repository. Jika berisi foto pengguna, batasi akses repository dan konsultasikan pemilik data sebelum menghapusnya dari indeks atau riwayat; penghapusan dari indeks saja tidak menghapus salinan pada riwayat, clone, atau remote.

## Test

```bash
pytest
```

Test health check tidak membutuhkan koneksi PostgreSQL. Migration membutuhkan PostgreSQL yang aktif.

## Environment

Jangan commit file `.env`. Gunakan `.env.example` sebagai template.
