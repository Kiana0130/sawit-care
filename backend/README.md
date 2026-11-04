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

Pastikan PostgreSQL tersedia dan database `sawitcare` sudah dibuat. Sesuaikan `DATABASE_URL` di `.env`, lalu jalankan migration:

```bash
alembic upgrade head
uvicorn app.main:app --reload
```

API tersedia di `http://localhost:8000`.

- Health check: `GET /v1/health`
- OpenAPI: `http://localhost:8000/docs`

## Test

```bash
pytest
```

Test health check tidak membutuhkan koneksi PostgreSQL. Migration membutuhkan PostgreSQL yang aktif.

## Environment

Jangan commit file `.env`. Gunakan `.env.example` sebagai template.
