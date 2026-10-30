# Kasir Laundry - Frontend

Aplikasi kasir laundry berbasis React + Vite dengan arsitektur **Offline-First**, IndexedDB (Dexie.js), dan sinkronisasi otomatis ke backend NestJS.

---

## 🔄 Cara Reset Database Lokal (Dexie IndexedDB)

Jika Anda ingin mereset seluruh data lokal di browser kasir (misal untuk pengujian ulang, mengganti outlet toko, membersihkan data mock, atau menyelesaikan konflik sync), Anda dapat menggunakan salah satu cara berikut:

### Cara 1: Lewat Console Browser (Paling Cepat ⚡)

1. Buka aplikasi di browser (Google Chrome, Edge, Safari, atau Brave).
2. Tekan tombol **F12** atau klik kanan pilih **Inspect** -> buka tab **Console**.
3. allow pasting
4. Salin dan tempel baris perintah berikut, lalu tekan **Enter**:
   ```javascript
   indexedDB.deleteDatabase('KasirLaundryDB');
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```
5. Halaman akan otomatis me-refresh dan membuat ulang database `KasirLaundryDB` dari awal (*auto-seed* data master baru).

---

### Cara 2: Lewat DevTools Application Tab (UI Manual 🖱️)

1. Buka browser **DevTools** (`F12` atau `Cmd + Option + I` di Mac).
2. Pilih tab **Application** (di Google Chrome / Edge) atau **Storage** (di Firefox).
3. Di panel navigasi sebelah kiri:
   - Klik **Storage** -> klik tombol **Clear site data**.
   - **ATAU** buka folder **IndexedDB** -> klik kanan pada database **`KasirLaundryDB`** -> pilih **Delete database**.
4. Bersihkan juga **Local storage** dan **Session storage** jika ingin mereset sesi login.
5. Refresh halaman browser (`F5` atau `Cmd + R`).

---

### Cara 3: Reset Programmatic (Lewat Kode JavaScript)

Jika ingin memanggil fungsi reset dari dalam kode frontend:

```javascript
import { db } from './db';

export async function resetDexieDatabase() {
  await db.delete();
  localStorage.clear();
  sessionStorage.clear();
  window.location.reload();
}
```

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
