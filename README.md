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

Untuk tahap pengembangan (Development), Anda dapat menjalankan Frontend dan Backend secara bersamaan dari *root* folder.

1. **Jalankan Database PostgreSQL**
   Pertama, nyalakan kontainer database melalui Docker:
   ```bash
   docker compose up -d
   ```
   *(Database akan berjalan pada `localhost:5433` untuk menghindari bentrok dengan servis Postgres bawaan)*

2. **Install Semua Dependencies**
   Cukup jalankan perintah ini dari *root folder* untuk meng-install paket untuk Frontend maupun Backend:
   ```bash
   npm install
   ```

3. **Jalankan Aplikasi Secara Bersamaan (Frontend + Backend)**
   ```bash
   npm run dev
   ```
   *Frontend (React) akan berjalan di `http://localhost:5173`*
   *Backend (NestJS) akan berjalan di `http://localhost:3000`*

   *(Catatan: Anda juga dapat menjalankan secara terpisah dengan `npm run dev:frontend` atau `npm run dev:backend`)*

---

## 📦 Cara Build (Production)

### Build Frontend (ReactJS)
Masuk ke direktori frontend dan jalankan perintah build. (Catatan: *Netlify* sudah dikonfigurasi untuk melakukan ini secara otomatis).
```bash
cd frontend
npm run build
```
File hasil *build* akan berada di dalam folder `frontend/dist`.

### Build Backend (NestJS)
Masuk ke direktori backend dan jalankan perintah build NestJS.
```bash
cd backend
npm run build
```
File hasil *build* (kompilasi TypeScript ke JavaScript) akan berada di dalam folder `backend/dist`. Untuk menjalankan *production server*, gunakan perintah:
```bash
npm run start:prod
```

---

## 🗄️ Panduan Database (Prisma ORM)

Semua operasi database dan perubahan struktur tabel (*schema*) dilakukan di dalam direktori **`backend`**. 
Selalu pastikan Anda berada di folder backend: `cd backend`.

1. **Melakukan Sinkronisasi Skema Database (Migrasi)**
   Jika Anda mengubah desain tabel di file `backend/prisma/schema.prisma`, Anda harus melakukan migrasi agar database PostgreSQL menyesuaikan bentuk strukturnya:
   ```bash
   # Jalankan perintah ini dari folder /backend
   npx prisma migrate dev --name deskripsi_perubahan
   npx prisma migrate dev --name init
   ```

2. **Generate Prisma Client**
   Setelah melakukan modifikasi skema, jalankan perintah ini untuk memperbarui sistem *autocompletion* (IntelliSense) di TypeScript:
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
