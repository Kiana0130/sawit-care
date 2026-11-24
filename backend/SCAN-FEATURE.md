# Menjalankan fitur scan dan riwayat

## Dependensi backend

Di environment Python backend, jalankan:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Migration `0002_scans_quota` menambah constraint/index idempotensi. API menyimpan foto di `backend/uploads/scans/<user_id>/` secara default; direktori dapat diubah dengan `SCAN_STORAGE_DIR`. Penyimpanan lokal ini dipakai tanpa MinIO; untuk deployment container mount volume persisten ke path upload tersebut.

## Mengetes fitur

1. Pastikan backend dan database berjalan.
2. Pastikan `.env` di root Expo memakai URL backend yang dapat dijangkau client. HP fisik memerlukan IP LAN komputer, bukan `localhost`; tunnel Expo tidak men-tunnel API.
3. Mulai ulang Metro sesudah mengubah `.env`, misalnya `npx expo start --tunnel --clear`.
4. Login, pilih foto JPEG/PNG/WebP berukuran maksimum 10 MB dan panjang sisi maksimum 2048 piksel, lalu tekan **Simpan Foto Scan**.
5. Foto disimpan dengan status **Menunggu model AI**. Tidak ditampilkan label penyakit maupun confidence palsu.
6. Buka **Riwayat** untuk melihat scan, gunakan filter, lalu tekan item untuk melihat foto dan detailnya. Dashboard dan kuota dimuat dari API.
7. Paket Free mendapat 5 scan sukses per tanggal WITA. Scan yang dihapus tetap dihitung sampai pergantian hari.

AI belum diaktifkan. Foto lokal di backend belum disimpan di object storage eksternal; backup direktori perlu diperhatikan, terutama jika menjalankan container.
