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
    // 1. Tutup koneksi Dexie
    if (db && typeof db.close === 'function') {
      try {
        db.close();
      } catch (e) {
        console.warn('[Reset] Error saat menutup koneksi Dexie:', e);
      }
    }

    // 2. Hapus IndexedDB
    if (window.indexedDB) {
      try {
        if (typeof indexedDB.databases === 'function') {
          const dbs = await indexedDB.databases();
          for (const d of dbs) {
            if (d.name) {
              indexedDB.deleteDatabase(d.name);
            }
          }
        } else {
          indexedDB.deleteDatabase('KasirLaundryDB');
        }
      } catch (e) {
        console.warn('[Reset] Error saat menghapus IndexedDB:', e);
        indexedDB.deleteDatabase('KasirLaundryDB');
      }
    }

    // 3. Hapus LocalStorage & SessionStorage
    localStorage.clear();
    sessionStorage.clear();

    // 4. Hapus Cache Storage (aset cache PWA/Service Worker)
    if ('caches' in window) {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      } catch (e) {
        console.warn('[Reset] Error saat menghapus Cache Storage:', e);
      }
    }

    // 5. Unregister semua Service Worker lama
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
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.location.reload();
      }
    }
  }
}
