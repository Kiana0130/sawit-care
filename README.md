# Sawit Care

Sawit Care adalah aplikasi mobile untuk membantu pengguna mencatat dan memantau foto tanaman kelapa sawit. Proyek ini terdiri dari aplikasi Expo/React Native dan API FastAPI dengan database PostgreSQL.

> **Status proyek:** masih dalam pengembangan. Model AI belum tersedia, sehingga foto yang disimpan berstatus **menunggu model AI**. Aplikasi belum menghasilkan diagnosis penyakit atau nilai confidence.

## Fitur yang tersedia

- Pendaftaran, login, dan logout dengan konfirmasi.
- Profil akun: melihat dan mengubah nama serta email, dan mengganti password. Setelah password diubah, pengguna perlu login kembali dan sesi lama tidak dapat digunakan lagi.
- Menyimpan foto scan serta melihat riwayat, detail, dan foto yang tersimpan. Penghapusan scan memerlukan konfirmasi.
- Dashboard dan informasi kuota berdasarkan data akun.
- Paket Free memiliki kuota 5 scan berhasil per hari berdasarkan waktu WITA. Menghapus scan tidak mengembalikan kuota hari itu.

Foto yang dipilih diproses menjadi salinan JPEG dengan sisi terpanjang maksimal 2048 piksel dan ukuran maksimal 10 MiB; foto asli di galeri tidak diubah. Foto dan akun tetap tersimpan di backend lokal selama database dan direktori penyimpanan tidak dihapus.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Aplikasi | Expo SDK 58, React Native, TypeScript, Expo Router |
| API | Python, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Penyimpanan foto | Direktori lokal backend; volume persisten tersedia untuk container |

## Persiapan

Siapkan Node.js dan npm, Python 3, Docker dengan Docker Compose, serta Expo Go yang kompatibel dengan SDK proyek di HP Android. Petunjuk di bawah menggunakan terminal Linux/macOS dan menjalankan PostgreSQL melalui Docker, sedangkan API dan Expo berjalan langsung di komputer.

Gunakan tiga terminal: satu untuk menjalankan API, satu untuk Expo, dan satu bila perlu untuk perintah tambahan. Jalankan semua perintah dari direktori proyek kecuali disebutkan lain.

### 1. Siapkan dan jalankan backend

Di terminal pertama:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Perintah `cp` di atas untuk penyiapan pertama saja: jangan timpa `.env` yang sudah berisi pengaturan yang ingin dipertahankan. Sesuaikan konfigurasi backend bila diperlukan; khususnya gunakan `JWT_SECRET_KEY` acak yang panjang dan rahasiakan nilainya. Konfigurasi contoh dan kredensial Docker Compose ditujukan untuk pengembangan lokal, bukan produksi.

Masih di direktori `backend`, jalankan:

```bash
docker compose up -d postgres
docker compose ps
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Biarkan terminal ini tetap berjalan. Buka `http://localhost:8000/v1/health` di komputer untuk memeriksa bahwa proses API hidup, atau `http://localhost:8000/docs` untuk dokumentasi endpoint. Health check saja tidak memastikan database dan penyimpanan foto siap.

### 2. Siapkan alamat API untuk HP

Di terminal kedua, dari root proyek:

```bash
npm install
cp .env.example .env
```

Perintah `cp` juga hanya untuk penyiapan pertama. Edit `.env` di root proyek dan isi alamat API dengan IP lokal komputer, misalnya:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000/v1
```

Ganti `192.168.1.10` dengan IP komputer sendiri; pada Linux, `hostname -I` bisa membantu menemukannya. Jangan gunakan `localhost` untuk HP fisik karena itu menunjuk ke HP, bukan komputer. HP dan komputer harus dapat saling terhubung, biasanya melalui Wi-Fi yang sama.

Sebelum membuka aplikasi, coba buka `http://<IP-KOMPUTER>:8000/v1/health` melalui browser HP. Jika gagal, periksa server API, jaringan, VPN, dan firewall komputer. `EXPO_PUBLIC_*` disertakan dalam aplikasi, jadi jangan simpan rahasia di sana.

### 3. Jalankan aplikasi

Di terminal kedua, masih dari root proyek:

```bash
npx expo start
```

Buka Expo Go di HP dan pindai QR code yang muncul. Jika `.env` root berubah, hentikan dan jalankan ulang Expo; bila perlu gunakan `npx expo start --clear`. Jika Metro sulit diakses melalui jaringan lokal, coba `npx expo start --tunnel`. **Tunnel Expo hanya meneruskan server Expo, bukan API**: alamat backend tetap harus dapat dijangkau HP.

## Pemeriksaan proyek

Dari root proyek:

```bash
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs tests/*.cjs
```

Untuk tes backend:

```bash
cd backend
source .venv/bin/activate
python -m pytest tests -q
```

Beberapa tes konkurensi memerlukan database PostgreSQL khusus yang dapat dibuang dan akan dilewati tanpa konfigurasi tersebut. Jangan arahkan tes itu ke database berisi data pengguna.

## Struktur proyek

```text
app/                   Halaman dan navigasi Expo Router
components/            Komponen antarmuka
lib/                   Utilitas dan komunikasi API
providers/             State autentikasi aplikasi
backend/app/           API, model, dan logika backend
backend/alembic/       Migrasi database
backend/tests/         Pengujian backend
tests/                 Pengujian frontend
```

## Catatan penyimpanan dan keamanan

- Secara default foto disimpan di `backend/uploads/scans/`, bukan di layanan object storage. Backup direktori foto bersama database jika datanya penting; untuk container gunakan volume persisten.
- Jangan unggah file `.env`, token, password, atau foto pengguna ke repository. Menghapus foto dari Git saat ini tidak otomatis menghapusnya dari riwayat atau clone lama.
- Konfigurasi ini untuk pengembangan lokal. Sebelum membuka API ke jaringan publik, siapkan HTTPS, rahasia yang aman, kontrol akses, backup, dan konfigurasi deployment yang sesuai.

Dokumentasi tambahan: [backend](backend/README.md), [scan dan riwayat](backend/SCAN-FEATURE.md), dan [kesiapan deployment](backend/DEPLOYMENT.md).