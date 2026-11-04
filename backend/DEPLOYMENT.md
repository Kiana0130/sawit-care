# Sawit Care API deployment guide

## Local development

```bash
cp .env.example .env
# Ubah password/database URL jika diperlukan
docker compose -f docker-compose.yml up -d
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

## Container deployment

1. Buat `.env` di server dari `.env.example`.
2. Ganti semua password default (`POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`) dengan secret kuat.
3. Isi `DATABASE_URL` menggunakan hostname service `postgres` bila database dijalankan pada compose yang sama.
4. Atur `CORS_ORIGINS` hanya ke origin yang diperlukan.
5. Jalankan:

```bash
docker compose -f docker-compose.deploy.yml up -d --build
```

Container API akan menjalankan `alembic upgrade head` sebelum Uvicorn dimulai. Untuk production publik, letakkan reverse proxy/TLS di depan service API dan jangan mengekspos PostgreSQL/MinIO ke internet secara langsung.

## Android client

Aplikasi Android tidak boleh menggunakan `localhost` untuk backend production. Set base URL API melalui environment/config Expo pada tahap integrasi frontend, misalnya `https://api.example.com`.
