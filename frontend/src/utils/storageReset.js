import { db } from '../db';

/**
 * Membersihkan seluruh data lokal aplikasi di browser:
 * - IndexedDB (KasirLaundryDB & database lainnya)
 * - LocalStorage & SessionStorage
 * - Cache Storage (PWA/Service Worker asset cache)
 * - Service Worker registrations
 *
 * @param {Object} options
 * @param {boolean} options.reload - Apakah otomatis me-reload halaman setelah reset
 * @param {string} options.redirectUrl - URL tujuan redirect setelah reset (opsional)
 */
export async function clearAllLocalData({ reload = true, redirectUrl = '/login' } = {}) {
  try {
    // 1. Kosongkan semua data tabel Dexie terlebih dahulu saat koneksi masih aktif
    if (db && Array.isArray(db.tables)) {
      try {
        await Promise.all(db.tables.map((table) => table.clear().catch(() => {})));
      } catch (e) {
        console.warn('[Reset] Error saat mengosongkan tabel Dexie:', e);
      }
    }

    // 2. Tutup koneksi Dexie dan hapus database via API Dexie
    if (db && typeof db.delete === 'function') {
      try {
        await db.delete();
      } catch (e) {
        console.warn('[Reset] Error saat db.delete():', e);
      }
    }

    // 3. Hapus database native IndexedDB dengan Promise wrapper
    if (typeof window !== 'undefined' && window.indexedDB) {
      const deleteDbAsync = (name) =>
        new Promise((resolve) => {
          try {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve(true);
            req.onerror = () => resolve(false);
            req.onblocked = () => resolve(false);
            // Fallback timeout jika browser seperti Brave memblokir onblocked
            setTimeout(() => resolve(false), 500);
          } catch {
            resolve(false);
          }
        });

      try {
        if (typeof indexedDB.databases === 'function') {
          const dbs = await indexedDB.databases().catch(() => []);
          for (const d of dbs) {
            if (d.name) {
              await deleteDbAsync(d.name);
            }
          }
        }
        await deleteDbAsync('KasirLaundryDB');
      } catch (e) {
        console.warn('[Reset] Error saat menghapus native IndexedDB:', e);
      }
    }

    // 4. Hapus LocalStorage & SessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // 5. Hapus Cache Storage (aset cache PWA/Service Worker)
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      } catch (e) {
        console.warn('[Reset] Error saat menghapus Cache Storage:', e);
      }
    }

    // 6. Unregister semua Service Worker lama
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      } catch (e) {
        console.warn('[Reset] Error saat unregister Service Worker:', e);
      }
    }

    console.log('[Reset] Semua data lokal dan cache berhasil dibersihkan.');
  } catch (err) {
    console.error('[Reset] Terjadi kesalahan saat mereset data lokal:', err);
  } finally {
    if (reload) {
      // Berikan jeda kecil agar disk commit selesai sebelum navigasi/reload
      setTimeout(() => {
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          window.location.reload();
        }
      }, 150);
    }
  }
}
