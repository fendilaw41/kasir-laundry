# Panduan Manajemen Store & Query Setup Store Baru

Dokumentasi ini menjelaskan cara mengelola Store (Toko/Outlet) dan menjalankan query manual untuk menambahkan Store baru di database PostgreSQL.

---

## 1. Konsep & Aturan Bisnis Multi-Store

1. **Identifikasi Toko**:
   - Setiap toko laundry memiliki `id` (UUID) dan **`code` (Store Code)** unik (contoh: `STORE01`, `STORE02`, `KL-KRW01`).
   - `code` bersifat unik (`UNIQUE`) dan case-insensitive pada penggunaan form.
2. **Aturan 1 Store = 1 Owner**:
   - Setiap Store **hanya boleh memiliki 1 akun dengan role `owner`**.
   - Jika pengguna mencoba mendaftar sebagai `owner` pada toko yang sudah memiliki owner, sistem (Frontend & Backend) akan **menolak pendaftaran**.
   - Staf tambahan dapat didaftarkan dengan role `kasir`.
3. **Syarat Register & Login**:
   - Baik saat pendaftaran akun maupun login ke server, **Kode Toko (Store Code)** menjadi syarat verifikasi agar data otomatis terisolasi per toko.

---

## 2. Struktur Tabel `Store`

| Kolom         | Tipe Data         | Deskripsi                                                        |
| ------------- | ----------------- | ---------------------------------------------------------------- |
| `id`        | `TEXT` (UUID)   | ID unik toko (Primary Key)                                       |
| `code`      | `TEXT` (UNIQUE) | **Kode Toko** untuk login & register (contoh: `STORE01`) |
| `name`      | `TEXT`          | Nama Toko / Outlet Laundry                                       |
| `address`   | `TEXT`          | Alamat fisik toko (opsional)                                     |
| `city`      | `TEXT`          | Kota lokasi toko (opsional)                                      |
| `phone`     | `TEXT`          | Nomor Telepon / WhatsApp toko (opsional)                         |
| `createdAt` | `TIMESTAMP`     | Waktu toko dibuat                                                |
| `updatedAt` | `TIMESTAMP`     | Waktu toko terakhir diperbarui                                   |

---

## 3. Query SQL Manual: Menambah Store Baru

Jalankan query berikut di PostgreSQL (menggunakan pgAdmin, DBeaver, psql, atau Docker exec):

### Contoh 1: Tambah Store dengan Auto-Generate UUID (Rekomendasi)

```sql
INSERT INTO "Store" ("id", "code", "name", "address", "city", "phone", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'STORE02',
  'Laundry Bersih',
  'Jl. Ahmad Yani No. 45',
  'Karawang',
  '081234567890',
  NOW(),
  NOW()
);
```

### Contoh 2: Tambah Store dengan UUID Manual / Ditentukan Sendiri

```sql
INSERT INTO "Store" ("id", "code", "name", "address", "city", "phone", "createdAt", "updatedAt")
VALUES (
  'b8364c61-0a4a-4428-bbcf-2c83c2741efb',
  'STORE02',
  'Laundry Bersih',
  'Jl. Sudirman No. 12',
  'Jakarta',
  '081298765432',
  NOW(),
  NOW()
);
```

---

## 4. Query SQL Opsional: Inisialisasi Settings Default Toko

Setelah menambahkan Store baru, Anda dapat langsung membuat pengaturan default struk dan profil toko:

```sql
INSERT INTO "Settings" ("storeId", "namaLaundry", "alamat", "kota", "telepon", "menerimaCucian", "headerStruk", "footerStruk", "updatedAt")
VALUES (
  (SELECT "id" FROM "Store" WHERE "code" = 'STORE02'),
  'Laundry Bersih',
  'Jl. Ahmad Yani No. 45',
  'Karawang',
  '081234567890',
  true,
  'Terima kasih atas kunjungan anda',
  'kasirlaundry.my.id',
  NOW()
)
ON CONFLICT ("storeId") DO NOTHING;
```

---

## 5. Query Berguna untuk Monitoring Store & Pengguna

### Melihat Daftar Seluruh Store yang Terdaftar

```sql
SELECT "id", "code", "name", "city", "phone", "createdAt" 
FROM "Store" 
ORDER BY "createdAt" DESC;
```

### Melihat Pengguna (Owner & Kasir) per Store

```sql
SELECT 
  s."code" AS "storeCode", 
  s."name" AS "storeName", 
  u."username", 
  u."fullname", 
  u."role",
  u."createdAt"
FROM "Store" s
LEFT JOIN "User" u ON s."id" = u."storeId" AND u."deletedAt" IS NULL
ORDER BY s."code", u."role";
```

### Memeriksa Apakah Store Tertentu Sudah Memiliki Owner

```sql
SELECT u."id", u."username", u."fullname", u."role", s."code" AS "storeCode"
FROM "User" u
JOIN "Store" s ON u."storeId" = s."id"
WHERE s."code" = 'STORE02' AND u."role" = 'owner' AND u."deletedAt" IS NULL;
```

---

## 6. Alur Pendaftaran Pengguna Baru

1. **Admin / Developer**:
   - Menjalankan query `INSERT INTO "Store"` untuk mendaftarkan toko baru beserta `code` (misal: `STORE02`).
2. **Owner Pertama Toko**:
   - Membuka halaman **Register** di aplikasi.
   - Mengisi:
     - **Kode Toko**: `STORE02`
     - **Role**: `Owner`
     - **Nama Lengkap**, **Username**, **Password**.
   - Sistem akan memvalidasi kode toko dan memastikan toko belum memiliki owner.
3. **Pencegahan Owner Ganda**:
   - Jika ada orang lain yang mencoba mendaftar kembali sebagai `Owner` menggunakan kode toko `STORE02`, sistem Backend dan Frontend akan langsung menolak dengan pesan:
     > *"Store 'Berkah Laundry Cabang 2' (STORE02) sudah memiliki Owner (budi). Hanya diperbolehkan 1 Owner untuk 1 Store."*
     >
4. **Kasir / Staff Tambahan**:
   - Dapat mendaftar menggunakan kode toko `STORE02` dengan memilih role `Kasir`.
