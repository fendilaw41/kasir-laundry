# 🧺 Kasir Laundry Backend API (NestJS + Prisma)

Backend service untuk aplikasi **Kasir Laundry** yang dirancang dengan pendekatan **Offline-First Synchronization**. Menggunakan framework **NestJS**, **Prisma ORM**, database **PostgreSQL**, serta dilengkapi dokumentasi interaktif **Swagger UI**.

---

## 🚀 Fitur Utama

- 🔄 **Offline-First Order Sync**: Sinkronisasi data pesanan lokal (Dexie/IndexedDB) ke backend PostgreSQL dengan sifat **Idempotent** (aman jika terjadi retry saat koneksi terputus).
- 📦 **Batch Sync Support**: Mendukung pengiriman antrean banyak pesanan sekaligus saat koneksi internet kembali aktif.
- 🏪 **Multi-Store Ready**: Struktur data terisolasi berdasarkan `storeId` (Multi-tenant).
- 📑 **Swagger OpenAPI 3.0**: Dokumentasi API interaktif yang terintegrasi langsung di `/api/docs`.
- 🗄️ **Prisma ORM**: Type-safe database queries dan migrasi skema yang terkelola.

---

## 🛠️ Tech Stack

- **Framework**: [NestJS v11](https://nestjs.com/)
- **ORM**: [Prisma ORM v7](https://www.prisma.io/)
- **Database**: PostgreSQL
- **Dokumentasi API**: Swagger UI (`@nestjs/swagger`)
- **Runtime**: Node.js & TypeScript

---

## ⚙️ Konfigurasi Environment (`.env`)

Buat file `.env` pada folder `backend/`:

```env
DATABASE_URL="postgresql://root:password@localhost:5432/kl_db?schema=public"
PORT=3000
```

---

## 🗃️ Skema Database & Migrasi Prisma

### 1. Model / Entitas Utama

| Model                   | Keterangan                                                                                                                |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **`Store`**     | Data outlet/toko laundry (Multi-tenant root).                                                                             |
| **`User`**      | Akun pengguna (Owner / Kasir).                                                                                            |
| **`Product`**   | Katalog layanan cuci, setrika, satuan, dll.                                                                               |
| **`Pelanggan`** | Data kontak dan alamat pelanggan laundry.                                                                                 |
| **`Inventory`** | Data stok bahan habis pakai (deterjen, parfum, plastik).                                                                  |
| **`Order`**     | Transaksi nota laundry (Total, Diskon, Bayar, Status, Tipe Antar).                                                        |
| **`OrderItem`** | Rincian item / layanan per pesanan (`orderId`, `price`, `qty`, `subtotal`).                                       |
| **`Settings`**  | Pengaturan profil outlet dan format struk cetak.                                                                          |
| **`SyncLog`**   | Catatan riwayat audit sinkronisasi (`beforeData`, `afterData`, `tableName`, `action`, `username`, `storeId`). |

### 2. Perintah Migrasi Database

```bash
# 1. Generate Prisma Client setelah perubahan schema.prisma
npx prisma generate

# 2. Menjalankan migrasi database di development
npx prisma migrate dev --name init

# 3. Atau langsung sinkronkan skema ke database (Prototyping / Push)
npx prisma db push

# 4. Membuka visual database viewer (Prisma Studio)
npx prisma studio

cd backend
npx prisma db push --force-reset
```

---

## 📖 Dokumentasi Swagger UI

Dokumentasi interaktif dapat diakses saat server berjalan pada:

📍 **URL Swagger**: `http://localhost:3000/api/docs`

Melalui antarmuka Swagger, Anda dapat melihat seluruh skema DTO, mencoba request langsung (*Try it out*), dan melihat contoh response.

---

## 🔌 Rincian Endpoint API & DTO

Prefix global API: `/api`

### 1. Sinkronisasi Pesanan Tunggal

- **Endpoint**: `POST /api/orders/sync`
- **Deskripsi**: Menyimpan atau memperbarui data satu pesanan dari client.

#### Request Body DTO (`SyncOrderDto`):

```json
{
  "id": "c3f81e69-0268-4a94-bfbe-d45e12f672fa",
  "storeId": "store-uuid-001",
  "invoiceId": "A1B2-00001",
  "userId": "user-uuid-001",
  "pelangganId": "pelanggan-uuid-001",
  "pelanggan": {
    "id": "pelanggan-uuid-001",
    "nama": "Budi Santoso",
    "hp": "081234567890",
    "alamat": "Jl. Melati No. 10"
  },
  "total": 45000,
  "diskon": 5000,
  "bayar": 50000,
  "kembalian": 5000,
  "metodeBayar": "Tunai",
  "estimasi": "Besok (24 Jam)",
  "tipeLayanan": "AJ",
  "isPriority": false,
  "statusBayar": "Lunas",
  "status": "Proses",
  "catatan": "Pakaian putih dipisah",
  "inventoryUsed": [
    { "id": 1, "nama": "Deterjen", "quantity": 1 }
  ],
  "items": [
    {
      "productId": "prod-uuid-001",
      "name": "Cuci Lipat Reguler",
      "quantity": 5,
      "price": 9000,
      "subtotal": 45000
    }
  ],
  "createdAt": "2026-10-09T07:20:00.000Z",
  "updatedAt": "2026-10-09T07:20:00.000Z"
}
```

#### Response Success (201 Created):

```json
{
  "success": true,
  "message": "Order berhasil disinkronkan",
  "data": {
    "id": "c3f81e69-0268-4a94-bfbe-d45e12f672fa",
    "storeId": "store-uuid-001",
    "invoiceId": "A1B2-00001",
    "total": 45000,
    "status": "Proses",
    "items": [...],
    "pelanggan": {...}
  }
}
```

---

### 2. Sinkronisasi Pesanan Batch (Antrean Offline)

- **Endpoint**: `POST /api/orders/sync-batch`
- **Deskripsi**: Menyinkronkan daftar antrean transaksi yang tertunda saat kasir beroperasi offline.
- **Request Body**: Array dari `SyncOrderDto` (`[ { ... }, { ... } ]`).

---

### 3. Mengambil Semua Daftar Order

- **Endpoint**: `GET /api/orders`
- **Query Params**: `?storeId=<store-uuid>` (Opsional)
- **Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": "c3f81e69-0268-4a94-bfbe-d45e12f672fa",
      "invoiceId": "A1B2-00001",
      "total": 45000,
      "statusBayar": "Lunas",
      "status": "Proses",
      "items": [...],
      "pelanggan": {...}
    }
  ]
}
```

---

### 4. Mengambil Detail Order Berdasarkan ID

- **Endpoint**: `GET /api/orders/:id`
- **Path Params**: `id` (UUID order)

---

## 🏃 Menjalankan Aplikasi

```bash
# 1. Install dependensi
npm install

# 2. Jalankan mode development (Watch mode)
npm run start:dev

# 3. Build aplikasi untuk production
npm run build

# 4. Jalankan production build
npm run start:prod
```
