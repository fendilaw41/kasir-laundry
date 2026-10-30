# 📋 Rencana Kerja & Desain Arsitektur: Fitur Chat Member Multi-Toko & Grup

Dokumen ini merinci konsep, desain UI/UX, arsitektur data (backend & offline-first frontend), standar **Clean Code**, **penjagaan storage browser (batas 3 hari offline)**, **dukungan multi-storage driver (Local vs S3/MinIO switchable via env/DB)**, analisis **potensi bug & edge cases**, serta pertimbangan **trade-off** dari implementasi fitur **Chat Kolaborasi Antar-Member & Grup**.

---

## 🎯 1. Ringkasan Visi & Kebijakan Bisnis (Opsi 2: Hybrid Role-Based)

Aplikasi Kasir Laundry memerlukan **komunikasi langsung (peer-to-peer dan group)** dengan prinsip hak akses berjenjang, kemudahan berbagi foto cucian/nota, dan perlindungan privasi multi-tenant yang ketat.

### 1.1 Kebijakan Hak Akses (Hybrid Scoping):

1. **Role `kasir` (Default: Terfilter Per Toko)**:
   - Kasir **hanya dapat melihat dan memilih rekan kerja di tokonya sendiri** (`storeId` yang sama) untuk chat 1-on-1 (*Direct Message*).
   - Kasir **hanya dapat membuat grup internal** untuk toko tempat ia bertugas.
   - Kasir **bisa berpartisipasi** di grup lintas cabang HANYA JIKA diundang oleh `owner`.
2. **Role `owner` (Hak Akses Lintas Cabang)**:
   - Pemilik toko (*owner*) dapat membuat **Grup Lintas Cabang (Cross-Store Group)** dan menambahkan kasir/staf dari cabang-cabang lain.
   - Memungkinkan koordinasi terpusat (misal: kirim foto bedcover/karpet khusus ke workshop pusat, koordinasi stok deterjen, atau pengumuman SOP).

### 1.2 Feature Flag Toggle via Backend Environment (`.env`):

Fitur grup lintas cabang ini dapat diaktifkan atau dinonaktifkan secara dinamis melalui konfigurasi server backend:

```env
# backend/.env
ENABLE_CROSS_STORE_CHAT=true    # Nilai: true | false (default: false)
```

- **Jika `ENABLE_CROSS_STORE_CHAT=false` (Non-aktif)**:
  - Frontend otomatis **menyembunyikan (*hide*)** semua opsi, tombol, dan tab pembuatan grup lintas cabang untuk semua pengguna (termasuk owner).
  - Backend memblokir pembuatan obrolan yang melibatkan member dari toko berbeda dengan pesan galat `403 Forbidden: Fitur chat lintas toko sedang dinonaktifkan`.
  - Sistem beroperasi 100% dalam mode **Strict Single-Store Isolation**.
- **Jika `ENABLE_CROSS_STORE_CHAT=true` (Aktif)**:
  - Role `owner` dapat melihat opsi pembuatan grup lintas cabang dan memilih member dari berbagai store.
  - Role `kasir` tetap terfilter per toko saat inisiasi chat baru, namun dapat melihat grup lintas cabang jika sudah diundang oleh owner.

---

## 📱 2. Desain Tampilan & Alur Pengguna (UI/UX)

### 2.1 Tampilan Level 1: Inbox / Chat List (`/chat`)

```
┌──────────────────────────────────────────────────────────────┐
│                    HEADER / NAVIGATION                       │
│  [Logo / Back]          Pesan & Kolaborasi         [+ Baru]  │
└──────────────────────────────────────────────────────────────┘
│ ⚠️ [BANNER PERINGATAN OFFLINE > 3 HARI - JIKA AKTIF]         │
│ "⚠️ Sudah 3 hari offline! Online-kan yuk biar data aman."     │
│ ⚠️ [BANNER GLOBAL LAYOUT - MUNCUL DI SEMUA HALAMAN JIKA OFFLINE > 3 HARI] │
│ "⚠️ Sudah 3 hari offline! Online-kan yuk biar data aman."                 │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Cari kontak atau pesan...                              ] │
├──────────────────────────────────────────────────────────────┤
│ 📌 PINNED CHAT (SELALU DI PALING ATAS)                       │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 🤖 [Bot Asisten Kasir]                      14:22       │ │
│ │    "Status Order #TEST-00012: SELESAI (Siap Diambil)"    │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ [ Semua ]   [ Toko Saya ]   [ Lintas Cabang* ]               │
│ *(Tab "Lintas Cabang" hanya muncul jika ENABLE_CROSS_STORE_CHAT=true) │
├──────────────────────────────────────────────────────────────┤
│ 💬 Chat                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 👥 Grup Operasional Karawang               14:15  [ 3 ]  │ │
│ │    Budi (Kasir): 📷 [Foto Cucian] Noda luntur di celana  │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 👤 Siti Aminah (Kasir)                     13:40  ✓✓     │ │
│ │    Doni, nota #0012 sudah diambil pelanggan ya          │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 🌐 [Lintas Cabang] Koordinasi Workshop     Kemarin       │ │
│ │    Owner: Kiriman karpet dari Cabang 2 sudah tiba        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│                                           [ ➕ Buat Chat ]  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Tampilan Level 2: Ruang Obrolan / Chat Room (`/chat/:id`)

```
┌──────────────────────────────────────────────────────────────┐
│ [← Back]  👥 Grup Operasional Karawang (3 Anggota)   [ ⋮ ]   │
└──────────────────────────────────────────────────────────────┘
│                                                              │
│  [Pesan Masuk - Rekan Kasir]                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Budi (Kasir)                                           │  │
│  │ ┌───────────────────────────┐                          │  │
│  │ │      [ FOTO CUCIAN ]      │                          │  │
│  │ │    (Max-width: 240px)     │                          │  │
│  │ └───────────────────────────┘                          │  │
│  │ Ada noda luntur di bagian kerah kemeja ini             │  │
│  │                                          14:12         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                       [Pesan Keluar - Anda]                  │
│                       ┌───────────────────────────────────┐  │
│                       │ Tolong foto nota fisiknya juga ya │  │
│                       │                       14:14  ✓✓   │  │
│                       └───────────────────────────────────┘  │
│                                                              │
│                       [Pesan Keluar - Baru/Offline]          │
│                       ┌───────────────────────────────────┐  │
│                       │ ┌───────────────────────────┐     │  │
│                       │ │      [ FOTO NOTA ]        │     │  │
│                       │ └───────────────────────────┘     │  │
│                       │ Ini foto nota fisiknya            │  │
│                       │                       14:15   ✓   │  │
│                       └───────────────────────────────────┘  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ [ 📷 ] [ 📎 ] [ Ketik pesan di sini...           ] [ ➤ Kirim]│
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Standar Komponen Chat Bubble:

1. **Penanda Pengirim (Sender Identity)**:
   - Pada **Chat Grup**: Nama pengirim ditampilkan jelas di bagian atas bubble dengan warna aksen (misal: `Budi (Kasir)` atau `Owner [Pusat]`).
   - Pada **Chat Personal (1-on-1)**: Pesan pengirim di sebelah kanan (biru), pesan lawan bicara di sebelah kiri (putih/abu-abu).
2. **Foto Langsung Nampil (Inline Preview)**:
   - Gambar langsung dirender di dalam gelembung chat.
   - **Dimensi Rapi**: `max-width: 240px` (atau `260px` pada layar desktop), `max-height: 280px`, `border-radius: 10px`, `object-fit: cover`.
   - **Interaktif (Click to Enlarge)**: Saat gambar diklik, membuka pop-up *lightbox/modal full preview* untuk melihat detail noda atau tulisan nota.
3. **Jam & Status Ceklis (Delivery Status)**:
   - **Timestamp**: Waktu pesan dikirim (format `HH:mm`, contoh: `14:15`).
   - **Ceklis 1 (`✓` Abu-Abu)**: **Pending** (pesan tersimpan di IndexedDB browser saat offline / sedang proses upload).
   - **Ceklis 2 (`✓✓` Abu-Abu/Biru)**: **Terkirim** (pesan berhasil diterima backend dan tersinkronisasi ke server/penerima).

---

## 📷 3. Arsitektur Upload Foto & Driver Penyimpanan Fleksibel (Local vs S3/MinIO)

Untuk memberikan fleksibilitas deployment (bisa berjalan di server mandiri maupun cloud cluster berbasis Docker/Kubernetes), sistem menggunakan **Storage Driver Pattern (Strategy Pattern)** yang dapat di-switch melalui konfigurasi `.env` atau nilai konfigurasi di database:

### 3.1 Konfigurasi Penyimpanan (`.env` dan DB Settings)

```env
# backend/.env

# Pilihan driver penyimpanan: 'local' | 's3' (MinIO / AWS S3 / Cloudflare R2)
STORAGE_DRIVER=local

# Konfigurasi S3 / MinIO (Hanya dibaca jika STORAGE_DRIVER=s3)
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=kasir-laundry-chat
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_USE_SSL=false
S3_FORCE_PATH_STYLE=true
```

> **Fallback Dinamis via DB**: Jika di database tabel `Settings` terisi nilai `storageDriver`, maka konfigurasi DB tersebut dapat me-override `.env` tanpa perlu me-restart server.

### 3.2 Struktur Isolasi Berkas per Store

Baik menggunakan penyimpanan **Lokal** maupun **S3/MinIO**, hierarki folder tetap **wajib terisolasi per `storeId`**:

```
[Mode Local]: backend/uploads/chat/
├── STORE_KRW01/                     <-- Folder Terisolasi Store 1
│   ├── STORE_KRW01_1730298000_a1b2c3d4.jpg
│   └── STORE_KRW01_1730298120_e5f6g7h8.png
├── STORE_BDG02/                     <-- Folder Terisolasi Store 2
│   └── STORE_BDG02_1730298500_9i0j1k2l.jpg
└── cross-store/                     <-- Khusus Grup Lintas Cabang (Owner)
    └── CROSS_1730299000_3m4n5o6p.jpg

[Mode S3/MinIO Bucket]: kasir-laundry-chat/
├── chat/STORE_KRW01/STORE_KRW01_1730298000_a1b2c3d4.jpg
├── chat/STORE_BDG02/STORE_BDG02_1730298500_9i0j1k2l.jpg
└── chat/cross-store/CROSS_1730299000_3m4n5o6p.jpg
```

### 3.3 Format Penamaan Berkas:

- Chat Kasir / Toko: `{storeId}_{timestamp}_{uuid}.[ext]` (contoh: `c4a2_1730298000_9fa12b.jpg`).
- Grup Lintas Cabang: `cross_{conversationId}_{timestamp}_{uuid}.[ext]`.

### 3.4 Alur Upload & Optimasi Kompresi:

1. **Pilihan Sumber di Frontend**:
   - **Kamera Langsung (`📷`)**: `<input type="file" accept="image/*" capture="environment" />`.
   - **Galeri Berkas (`📎`)**: `<input type="file" accept="image/png, image/jpeg, image/webp" />`.
2. **Kompresi Ringan Client-Side**:
   - Foto kamera HP beresolusi tinggi otomatis di-*resize* di browser (canvas) menjadi maksimal `1280px` dan kualitas JPEG `0.82` (mengurangi ukuran dari ~5MB menjadi ~250KB tanpa kehilangan ketajaman teks nota).
3. **Abstraksi Backend Service (`ChatStorageService`)**:
   - Controller tidak perlu tahu file disimpan di mana.
   - `ChatStorageService.saveFile(file, storeId)` akan mendelegasikan ke `LocalStorageDriver` atau `S3MinioStorageDriver` tergantung config aktif.
4. **Proteksi Akses Gambar (Scoped Streaming Endpoint)**:
   - Endpoint: `GET /chat/files/:storeId/:filename`.
   - Backend memverifikasi hak akses JWT sebelum melakukan *stream file lokal* atau *redirect presigned URL MinIO*. Staf dari `STORE_BDG02` dilarang mengunduh foto milik `STORE_KRW01`.

---

## 🛡️ 4. Penjagaan Storage Browser: Batas Offline 3 Hari & Peringatan Otomatis

Penyimpanan browser (*IndexedDB*) dapat cepat terisi penuh jika perangkat kasir menyimpan banyak foto dalam antrean offline selama berhari-hari. Untuk mencegah memori browser penuh dan risiko data terhapus oleh garbage collector OS, sistem menerapkan mekanisme penjagaan berikut:

### 4.1 Pelacakan Waktu Online di Database Lokal (`db.settings`)

Di tabel Dexie `settings`, ditambahkan kolom penanda waktu:

- `lastOnlineAt`: Timestamp terakhir kali kasir terhubung dan sukses berkomunikasi dengan backend.
- `offlineSince`: Timestamp saat perangkat mulai kehilangan koneksi internet.

```javascript
// frontend/src/services/internetStatusWatcher.js
window.addEventListener('online', async () => {
  await db.settings.update(1, { lastOnlineAt: new Date(), offlineSince: null });
});

window.addEventListener('offline', async () => {
  const current = await db.settings.get(1);
  if (!current.offlineSince) {
    await db.settings.update(1, { offlineSince: new Date() });
  }
});
```

### 4.2 Aturan Penjagaan & Peringatan 3 Hari (72 Jam):

1. **Pengecekan Ambang Batas 3 Hari**:
   - Setiap kali aplikasi dibuka atau kasir masuk ke halaman Chat, sistem menghitung durasi offline:
     ```javascript
     const isOfflineOverLimit = offlineSince && (Date.now() - new Date(offlineSince).getTime() > 3 * 24 * 60 * 60 * 1000);
     ```
2. **Peringatan Banner Kritis**:
   - Jika offline > 3 hari dan terdapat antrean pesan/foto belum tersinkron (`isDirty: 1`):
     - Muncul banner peringatan simpel di bagian atas layar:
       > ⚠️ **Sudah 3 hari offline!** Sambung internet yuk, biar data sinkron aman.
       >
3. **Peringatan Banner Kritis (Berlaku Global di Seluruh Aplikasi)**:
   - Ditempatkan pada level **`Layout.jsx`** sehingga otomatis tampil di **semua halaman aplikasi** (Home, POS Transaksi, Data Order, Pembayaran, Chat, Laporan, Setting), bukan hanya di halaman chat saja.
   - Jika offline > 3 hari dan terdapat antrean transaksi, order, atau pesan/foto belum tersinkron (`isDirty: 1`):
     - Muncul banner peringatan simpel berwarna kuning/merah lembut di bagian atas layar (tepat di bawah header):
       > ⚠️ **Sudah 3 hari offline!** Sambung internet yuk, biar data & foto kasir langsung sinkron aman.
       >
4. **Pemberitahuan Sebelum Ambil Foto Baru**:
   - Jika kasir menekan tombol kamera (`📷`) saat offline > 3 hari, muncul pop-up simpel:
     > 📸 *"Kasir offline > 3 hari. Online-kan dulu sebentar yuk biar data nggak numpuk!"*
     >
5. **Eviction / Pembersihan Otomatis setelah Sukses Sync**:
   - Begitu koneksi internet tersambung dan foto berhasil diunggah ke server (Lokal / MinIO), objek biner `imageBlob` di Dexie **segera dihapus** dan digantikan dengan URL server `imageUrl`. Ini menjamin IndexedDB browser kasir tetap ramping (< 10MB).

---

## 🗄️ 5. Arsitektur Data & Skema Database

### 5.1 Backend: PostgreSQL (Prisma ORM)

```prisma
enum ConversationType {
  DIRECT       // Chat 1-on-1 sesama member
  GROUP        // Grup chat internal toko
  CROSS_STORE  // Grup koordinasi lintas cabang (khusus owner)
}

enum MessageType {
  TEXT
  IMAGE        // Pesan foto/gambar
  ORDER_SNIPPET
  SYSTEM
}

enum MessageStatus {
  PENDING      // Ceklis 1: Masih di lokal kasir / antrean
  SENT         // Ceklis 2: Diterima server backend
  READ         // Ceklis 2 Biru: Sudah dibaca
}

model Conversation {
  id          String           @id @default(uuid())
  type        ConversationType @default(DIRECT)
  title       String?          // Nama grup (opsional jika direct)
  avatarUrl   String?
  createdById String
  createdBy   User             @relation("CreatedConversations", fields: [createdById], references: [id])
  storeId     String?          // Null jika type = CROSS_STORE
  store       Store?           @relation(fields: [storeId], references: [id])
  createdAt   DateTime         @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime         @updatedAt @db.Timestamptz(3)
  deletedAt   DateTime?        @db.Timestamptz(3)

  members     ConversationMember[]
  messages    Message[]

  @@index([storeId, updatedAt])
}

model ConversationMember {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           String       @default("member") // "admin" | "member"
  lastReadAt     DateTime     @default(now()) @db.Timestamptz(3)
  joinedAt       DateTime     @default(now()) @db.Timestamptz(3)

  @@unique([conversationId, userId])
  @@index([userId])
}

model Message {
  id             String        @id @default(uuid())
  uuid           String        @unique          // Client-generated idempotency key
  conversationId String
  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User          @relation(fields: [senderId], references: [id])
  content        String?       @db.Text         // Teks pesan (bisa null jika hanya kirim foto)
  type           MessageType   @default(TEXT)
  imageUrl       String?                        // Path / Key file gambar
  imageWidth     Int?
  imageHeight    Int?
  fileSize       Int?
  status         MessageStatus @default(SENT)
  metadata       Json?                          // Cuplikan info order/nota jika share invoice
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)
  deletedAt      DateTime?     @db.Timestamptz(3)

  @@index([conversationId, createdAt])
}
```

### 5.2 Frontend: Dexie.js (IndexedDB Offline-First v3)

Penambahan skema versi 3 di `frontend/src/db.js`:

```javascript
db.version(3).stores({
  // Tabel pengaturan lokal (dengan tracking offline 3 hari)
  settings: 'id, deviceId, lastOnlineAt, offlineSince, updatedAt, isDirty',
  // Tabel percakapan lokal kasir
  conversations: '++id, &uuid, type, title, storeId, lastMessageText, lastMessageAt, updatedAt, isDirty',
  // Relasi anggota obrolan
  conversationMembers: '++id, &uuid, conversationId, userId, role, lastReadAt',
  // Pesan obrolan (mendukung text + imageBlob offline + status ceklis)
  messages: '++id, &uuid, conversationId, senderId, senderName, content, type, imageUrl, imageBlob, status, createdAt, updatedAt, isDirty',
});
```

- Field `status` pada tabel `messages`:
  - `'pending'`: Ditampilkan dengan **Ceklis 1 (`✓`)**. Pesan atau foto masih berada di browser kasir (antrean sync).
  - `'sent'`: Ditampilkan dengan **Ceklis 2 (`✓✓`)**. Pesan telah berhasil sampai ke backend NestJS.

---

## ⚙️ 6. Endpoint Backend & WebSocket API

### 6.1 REST API Endpoints (NestJS)

- `GET /chat/config`: Mengambil status fitur flag `ENABLE_CROSS_STORE_CHAT` & driver storage aktif (`local` / `s3`).
- `GET /chat/conversations`: Mengambil daftar inbox obrolan pengguna.
- `POST /chat/conversations`: Membuat obrolan baru (direct, grup toko, atau lintas cabang).
- `GET /chat/conversations/:id/messages`: Mengambil histori pesan paginasi.
- `POST /chat/conversations/:id/messages`: Mengirim pesan teks baru via REST.
- `POST /chat/upload`: Endpoint upload foto multipart/form-data.
  - Parameter: `file`, `conversationId`, `clientUuid`.
  - Mengembalikan: `{ imageUrl, width, height, fileSize }`.
- `GET /chat/files/:storeId/:filename`: Menampilkan file gambar dengan verifikasi hak akses toko (stream lokal atau presigned URL S3).
- `POST /chat/conversations/:id/read`: Menandai pesan di room telah dibaca.
- `GET /chat/contacts`: Mengambil kontak staf yang berhak dihubungi user.

### 6.2 WebSocket Gateway (`@WebSocketGateway`)

- `send_message`: Mengirimkan pesan (teks atau gambar) secara instan dengan `clientUuid`.
- `message_delivered`: Notifikasi ke pengirim bahwa pesan telah sampai di server (mengubah status lokal dari Ceklis 1 `pending` menjadi Ceklis 2 `sent`).
- `typing`: Notifikasi sedang mengetik.

---

## 🧱 7. Struktur Modul & Komponen Frontend

```
frontend/src/
├── components/
│   ├── OfflineAlertBanner.jsx         // Banner global peringatan offline > 3 hari (di Layout.jsx)
│   └── chat/
│       ├── ChatOfflineAlertBanner.jsx // Banner peringatan offline > 3 hari
│       ├── ChatListHeader.jsx         // Header inbox & tombol tambah chat/grup
│       ├── ChatListItem.jsx           // Baris inbox (termasuk Pinned Asisten Order)
│       ├── ChatRoomHeader.jsx         // Header room (nama, status, back button)
│       ├── ChatBubble.jsx             // Gelembung chat: nama pengirim, jam, ceklis 1/2
│       ├── ChatImagePreview.jsx       // Komponen gambar inline rapi & responsif
│       ├── ChatImageModal.jsx         // Modal pop-up preview foto ukuran penuh (zoom)
│       ├── ChatInputBar.jsx           // Input textarea, tombol kamera, & tombol upload file
│       ├── CreateGroupModal.jsx       // Modal formulir pembuatan grup baru
│       └── NewChatModal.jsx           // Modal pencarian kontak staf toko
├── pages/
│   ├── Chat.jsx                       // Router utama chat: toggle Inbox List vs Chat Room
│   └── ChatOrderView.jsx              // Tampilan Chat Order asisten bot kasir
├── services/
│   ├── chatUploadService.js           // Client-side image resize canvas & upload API
│   ├── chatSocketService.js           // Koneksi real-time socket.io & status ceklis
│   └── chatSyncService.js             // Background sync pengiriman pesan & foto saat offline
└── db/
    └── repositories/
        └── chat.js                    // Kueri Dexie: getConversations, getMessages, saveMessage
```

---

## 🧹 8. Standar Clean Code & Disiplin Koding (Wajib Setiap Coding)

Untuk menjaga kualitas kode, maintainability, dan konsistensi di seluruh codebase (frontend React & backend NestJS), seluruh implementasi wajib mengikuti disiplin berikut:

### 8.1 Meaningful Names (Penamaan Bermakna & Representatif)

- Variabel & Properti: Mengungkapkan intensi dengan jelas (contoh: `isCrossStoreEnabled`, bukan `flag`; `messageTimestamp`, bukan `ts`).
- Fungsi: Format `verb + noun` yang spesifik (contoh: `compressImageBeforeUpload()`, `markConversationAsRead()`, bukan `handle()`, `doChat()`).
- Boolean: Selalu gunakan awalan predikat (`is`, `has`, `can`, `should`) seperti `isMessagePending`, `hasAttachment`, `canAccessStore`.
- Hindari singkatan ambigu atau magic numbers (gunakan konstanta: `MAX_IMAGE_WIDTH_PX = 1280`, `IMAGE_JPEG_QUALITY = 0.82`, `MAX_OFFLINE_DAYS_MS = 259200000`).

### 8.2 Small Single-Responsibility Functions (Prinsip Fungsi Tunggal & Ramping)

- Satu fungsi hanya melakukan **satu tugas utama** dan maksimal 10–20 baris.
- Terapkan **Guard Clauses (Early Return)**: Periksa validasi atau kondisi gagal di baris teratas fungsi untuk menghindari indentasi `if-else` bertingkat (*arrow anti-pattern*).
- Hindari argumen flag `boolean` yang mengubah perilaku fungsi secara drastis (pisahkan menjadi 2 fungsi terpisah jika fungsinya berbeda).

### 8.3 Clean Error Handling & No Null Passing

- Jangan mengembalikan `null` atau `undefined` yang memaksa pemanggil melakukan null-check berantai; kembalikan array kosong `[]`, objek representasi kosong (*Null Object pattern*), atau lempar *custom exception*.
- Backend: Gunakan NestJS standard exceptions (`NotFoundException`, `ForbiddenException`, `BadRequestException`) dengan pesan yang mendeskripsikan konteks kegagalan.
- Frontend: Tangani kegagalan koneksi secara elegan dengan *graceful degradation* (tampilkan indikator "Offline - Pesan disimpan lokal" tanpa crash pada UI).

### 8.4 Unit Testing & FIRST Principle

- Setiap logika krusial (kompresi gambar, penghitungan batas 3 hari offline, validasi akses storeId, transisi ceklis 1 ke 2) wajib memiliki unit test yang mematuhi pola **Arrange-Act-Assert (AAA)**.
- Prinsip F.I.R.S.T: Fast, Independent, Repeatable, Self-validating, Timely.

### 8.5 Boy Scout Rule

- *Selalu tinggalkan kode dalam kondisi yang lebih bersih dan rapi daripada saat pertama kali Anda membukanya.* Rapikan import yang tidak terpakai, format konsisten dengan ESLint/Prettier, dan hapus sisa console log debug.

---

## ⚠️ 9. Analisis Potensi Bug & Mitigasi Teknis (Edge Cases)

| Potensi Bug / Edge Case                                            | Skenario Masalah                                                                                                                      | Dampak                                                                   | Mitigasi Teknis yang Diterapkan                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Pesan Duplikat Saat Sync Ulang**                        | Kasir mengirim 3 pesan saat offline. Saat koneksi online kembali, background sync dan socket connect mengirim pesan secara bersamaan. | Pesan muncul ganda di database & chat lawan bicara.                      | **Idempotency Key**: Gunakan client-generated `uuid` pada setiap pesan. Backend menerapkan constraint `@@unique([uuid])` di PostgreSQL. Jika `uuid` sudah ada, backend mengabaikan duplikasi (*upsert/no-op*).        |
| **2. Ephemeral Object URL Mati Setelah Refresh**             | Foto offline disimpan dalam bentuk `URL.createObjectURL(file)`. Kasir me-refresh tab sebelum internet aktif.                        | Gambar menjadi blank / ikon gambar rusak (*broken image*).             | **IndexedDB Binary Storage**: Simpan file gambar sementara sebagai objek `Blob` asli di Dexie (`imageBlob`), lalu generate `createObjectURL` baru saat komponen dirender. Hapus blob setelah sukses upload.             |
| **3. Path Traversal & Akses Foto Ilegal**                    | Pengguna nakal memanipulasi parameter URL: `/chat/files/../STORE_LAIN/secret.png`.                                                  | Kebocoran foto nota/cucian toko lain (*security vulnerability*).       | **Strict Sanitization**: Gunakan `path.basename(filename)` di backend dan validasi regex format UUID `{storeId}_{timestamp}_{uuid}.[ext]`. Tolak request jika format nama file tidak sesuai.                              |
| **4. Storage Browser Penuh Saat Kasir Berhari-hari Offline** | Kasir offline lebih dari 3 hari dan terus mengambil ratusan foto cucian tanpa pernah sinkron.                                         | Browser melempar *QuotaExceededError*, database IndexedDB korup/macet. | **Peringatan 3 Hari & Eviction**: Sistem mendeteksi `offlineSince > 3 hari`, memunculkan banner peringatan darurat, dan langsung membuang `imageBlob` lokal begitu berhasil terunggah ke server/MinIO.                    |
| **5. Kegagalan Koneksi S3/MinIO Saat Switch Mode**           | Admin mengubah env `STORAGE_DRIVER=s3` tetapi service MinIO belum siap atau salah kredensial.                                       | Upload foto gagal total dan server crash.                                | **Graceful Driver Fallback**: Inisialisasi S3 driver memvalidasi koneksi (`HeadBucket`) saat boot; jika gagal, berikan log error yang jelas atau fallback sementara ke `local` dengan peringatan sistem.                  |
| **6. Silent WebSocket Disconnect di Mobile Browser**         | Saat browser di HP berpindah tab atau layar terkunci, browser membekukan koneksi WebSocket tanpa memicu event `disconnect`.         | Kasir tidak menerima pesan masuk baru sampai halaman di-refresh.         | **Heartbeat Ping/Pong**: Frontend mengirim ping setiap 25 detik. Jika tidak ada pong dalam 10 detik, frontend mengasumsikan koneksi putus dan memicu *auto-reconnect* instan saat tab aktif kembali (`visibilitychange`). |

---

## ⚖️ 10. Analisis Trade-Off & Pertimbangan Desain

| Keputusan Desain                                            | Keuntungan (*Pros*)                                                                                                                                                       | Konsekuensi / Kompromi (*Cons / Trade-offs*)                                                                                              | Solusi Rekomendasi                                                                                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Storage Driver Switchable (Local vs S3/MinIO)**     | Fleksibilitas tinggi: server development/on-premise bisa pakai folder lokal tanpa instalasi rumit, sedangkan production cluster bisa langsung pakai MinIO/S3 terdistribusi. | Butuh memelihara 2 implementasi driver di backend dan pengelolaan lifecycle kredensial MinIO.                                               | Bungkus dalam satu interface tunggal `StorageDriver` (Clean Code), sehingga controller tetap bersih dan tidak terpengaruh jenis driver.         |
| **Pembersihan Blob Foto Setelah Sync (*Eviction*)** | Menjaga database lokal IndexedDB kasir tetap ringan (< 10MB) dan mencegah memori HP kasir kepenuhan.                                                                        | Kasir yang ingin melihat foto lama yang sudah berhari-hari lalu memerlukan koneksi internet untuk streaming dari server/MinIO.              | Sangat sepadan (*best practice*). Foto lama yang sudah tersimpan aman di server di-cache oleh HTTP cache browser biasa.                         |
| **Peringatan Batas 3 Hari Offline**                   | Mencegah penumpukan transaksi tanpa sinkronisasi yang berisiko data hilang jika HP kasir rusak/terformat.                                                                   | Kasir yang tokonya memang di daerah tanpa internet stabil akan sering melihat banner peringatan.                                            | Desain banner tetap ramah (*non-blocking*), hanya berupa peringatan pengingat tanpa mematikan fitur kasir offline.                              |
| **Kompresi Gambar Sisi Klien (Canvas 1280px)**        | Sangat hemat kuota data kasir, waktu upload jauh lebih singkat (dari 5MB menjadi ~250KB), dan beban server backend ringan.                                                  | Detail tulisan kecil pada nota struk thermal yang difoto dari jarak jauh bisa sedikit berkurang ketajamannya jika kompresi terlalu agresif. | Gunakan kualitas JPEG `0.82` dan resolusi panjang `1280px` yang merupakan *sweet-spot* antara keterbacaan teks nota dan ukuran file ringan. |

---

## 📅 11. Rencana Kerja (Phased Roadmap)

| Tahap            | Aktivitas                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Estimasi Output                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Fase 1 (✅ SELESAI)** | **Rancangan Skema, Migrasi & Storage Driver Setup**<br>- Tambah model Prisma dengan field `imageUrl`, `uuid`, `type`, `status`.<br>- Tambah variabel `ENABLE_CROSS_STORE_CHAT` dan konfigurasi S3/MinIO di `backend/.env.example` & `backend/.env`.<br>- Buat modul `StorageDriver` (Local & S3/MinIO) dengan switchable config (Clean Code strategy pattern).<br>- Jalankan Prisma migration / db push & generate client.<br>- Tambah skema Dexie versi 3 di `frontend/src/db.js` (mendukung `imageBlob`, `lastOnlineAt`, `offlineSince`). | Database siap, modul storage switchable terpasang, unit test passed, dan skema offline siap. |
| **Fase 2 (✅ SELESAI)** | **Backend Upload & Core API (Clean Code Standards)**<br>- Modul Multer upload foto dengan isolasi folder/bucket per `storeId`.<br>- Implementasi penyimpanan ke Local disk atau S3/MinIO sesuai driver aktif.<br>- Terapkan validasi `ENABLE_CROSS_STORE_CHAT` & filter role Kasir vs Owner.<br>- Endpoint streaming gambar aman `/chat/files/:storeId/:filename`.<br>- WebSocket gateway untuk update status ceklis 1 -> 2.<br>- Unit testing `ChatService` (29 backend tests passed). | Backend siap menerima teks, foto kamera (Local/MinIO), dan event socket real-time. |
| **Fase 3 (✅ SELESAI)** | **Sinkronisasi Offline, Penjagaan 3 Hari & Kompresi**<br>- Utilitas kompresi foto sisi browser (Canvas resize max 1280px, q=0.82).<br>- Logika pelacakan `offlineSince` dan banner peringatan batas 3 hari offline global di `Layout.jsx`.<br>- Antrean upload foto offline via Dexie (`imageBlob` aman dari refresh) dan pembersihan otomatis setelah sync.<br>- Logika transisi status dari pending (Ceklis 1 `✓`) ke terkirim (Ceklis 2 `✓✓`).<br>- Unit testing `OfflineAlertBanner` passed. | Kasir aman dari masalah storage penuh; foto dikirim otomatis saat online. |
| **Fase 4 (✅ SELESAI)** | **Frontend: Chat List & Pinned Asisten Order**<br>- Tampilan daftar percakapan mirip WhatsApp.<br>- **Asisten Kasir** tetap tersemat di posisi paling atas (*pinned*).<br>- Filter tab cepat (**Semua**, **Toko Saya**, **Lintas Cabang**).<br>- Modal mulai obrolan baru dan buat grup. | Halaman inbox percakapan fungsional, rapi, dan responsif. |
| **Fase 5 (✅ SELESAI)** | **Frontend: Chat Room, Input Media & Bubble Gambar**<br>- Gelembung chat dengan nama pengirim, jam, dan icon ceklis 1 (`✓`) / ceklis 2 (`✓✓`).<br>- Inline image rapi (`max-width: 240px`) + modal perbesar gambar.<br>- Tombol input kamera langsung (`capture="environment"`) dengan konfirmasi penjagaan offline 3 hari dan tombol file galeri.<br>- Typing indicator & auto-resize textarea. | Ruang obrolan lengkap dengan multimedia dan penanda pesan yang jelas. |
| **Fase 6 (✅ SELESAI)** | **Uji Coba, Keamanan & Penyempurnaan**<br>- Unit testing backend (29 tests passing di Jest) dan frontend (23 tests passing di Vitest).<br>- Verifikasi build frontend & backend tanpa error.<br>- Isolasi hak akses file dan filter toko verified. | Fitur chat multimedia terverifikasi aman, stabil, bersih, dan siap produksi. |
