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

## Pemeriksaan kesiapan operasional

- Gunakan `ENVIRONMENT=production` dan `JWT_SECRET_KEY` yang kuat dan unik; atur URL database, password, dan CORS sebelum deployment. Jangan menaruh secret dalam repository atau log.
- `GET /v1/health` hanya menunjukkan proses API merespons; endpoint ini **tidak** memeriksa database, migration, dependensi Pillow, atau penyimpanan upload. Respons sehat bukan bukti sistem siap menerima scan.
- Pastikan migration berhasil (`alembic current` sesuai `alembic heads`), database dapat diakses, dan direktori `SCAN_STORAGE_DIR` dapat ditulis. Compose deployment memakai volume persisten `sawitcare-uploads`; backup dan uji pemulihan database **dan** volume upload bersama-sama. MinIO belum dipakai untuk foto scan.
- Pillow dan `python-multipart` diperlukan untuk menerima scan. Instal `requirements.txt` pada environment API atau rebuild image. Jika respons scan `503 IMAGE_VALIDATION_UNAVAILABLE`, periksa log API dan instalasi Pillow, lalu restart/redeploy; jangan anggap sebagai gambar tidak valid.
- Lakukan smoke test terautentikasi pada lingkungan uji: unggah JPEG kecil, periksa status pending, kuota, riwayat dan pengambilan foto, lalu hapus data uji. Penghapusan scan tidak mengembalikan kuota harian. Model AI belum diaktifkan.
- Suite backend menggunakan SQLite in-memory secara default: jalankan `python -m pytest` dari direktori `backend` setelah instalasi requirements. Jika menetapkan `TEST_DATABASE_URL`, gunakan database khusus yang boleh dihapus: test membuat dan menghapus tabel. Suite ini tidak membuktikan migrasi atau perilaku PostgreSQL production.

## Android client

Aplikasi Android tidak boleh menggunakan `localhost` untuk backend production. Set base URL API melalui environment/config Expo pada tahap integrasi frontend, misalnya `https://api.example.com`.
