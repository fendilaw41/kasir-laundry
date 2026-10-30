# Kasir Laundry - Frontend

Aplikasi kasir laundry berbasis React + Vite dengan arsitektur **Offline-First**, IndexedDB (Dexie.js), dan sinkronisasi otomatis ke backend NestJS.

---

## 🔄 Cara Reset Database Lokal (Dexie IndexedDB)

Jika Anda ingin mereset seluruh data lokal di browser kasir (misal untuk pengujian ulang, mengganti outlet toko, membersihkan data mock, atau menyelesaikan konflik sync), Anda dapat menggunakan salah satu cara berikut:

### Cara 1: Langsung Buka URL Reset (Paling Praktis & Otomatis 🚀)

Anda dapat langsung membuka URL berikut di address bar browser:
- **`http://localhost:5173/reset`**
  Membuka halaman visual reset untuk membersihkan IndexedDB, LocalStorage, dan Cache PWA.
- **`http://localhost:5173/?reset=true`** atau **`http://localhost:5173/reset?auto=true`**
  Langsung membersihkan seluruh data offline & cache PWA secara otomatis, lalu mengarahkan ke halaman login yang bersih.

---

### Cara 2: Lewat Menu Pengaturan Aplikasi (UI Toko ⚙️)

1. Masuk ke aplikasi, lalu buka menu **Pengaturan** (`/setting`).
2. Gulir ke bagian paling bawah ke kartu **"Pemeliharaan Sistem & Reset Cache"**.
3. Klik tombol **"Reset Cache & Database Lokal"** dan konfirmasi. Seluruh data lokal dan cache akan dibersihkan.

---

### Cara 3: Lewat DevTools Tab Application (Seperti Tangkapan Layar DevTools 🖱️)

1. Buka browser **DevTools** (`F12`).
2. Pilih tab **Application** -> buka menu **IndexedDB** -> klik **`KasirLaundryDB`**.
3. Klik tombol **`Delete database`** (seperti tombol yang tampil pada layar DevTools).
4. Atau klik menu **Storage** di panel kiri -> klik tombol **`Clear site data`** untuk menghapus IndexedDB, LocalStorage, dan Service Worker sekaligus.
5. Muat ulang halaman browser (`F5` / `Ctrl + F5`).

---

### Cara 4: Lewat Console Browser (Skrip Cepat ⚡)

1. Tekan tombol **F12** -> buka tab **Console**.
2. Salin dan tempel baris perintah berikut, lalu tekan **Enter**:
   ```javascript
   indexedDB.deleteDatabase('KasirLaundryDB');
   localStorage.clear();
   sessionStorage.clear();
   caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
   location.reload();
   ```

---

### Cara 5: Pemulihan Otomatis Perbedaan Versi (Auto-Recovery 🛡️)

Jika browser Anda sebelumnya memiliki versi IndexedDB yang lebih tinggi (misalnya **Version 91** dari pengujian lama), skrip frontend di [src/db.js](file:///c:/work/product/kasir-laundry/frontend/src/db.js) kini secara otomatis mendeteksi error `VersionError`, menghapus database lama yang konflik, dan me-reload aplikasi secara otomatis tanpa perlu tindakan manual.


---

## 🛠️ Pengembangan & Build

```bash
# Instalasi dependensi
npm install

# Menjalankan dev server lokal
npm run dev

# Menjalankan unit test (Vitest)
npx vitest run

# Build produksi (PWA)
npm run build
```
