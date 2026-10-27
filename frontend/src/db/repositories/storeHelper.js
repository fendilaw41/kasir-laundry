import { db } from '../../db.js';

/**
 * Mengambil storeId aktif saat ini.
 * Sumber prioritas:
 * 1. sessionStorage 'user' (user yang sedang login di sesi aktif)
 * 2. db.settings (konfigurasi storeId toko yang tersimpan di IndexedDB)
 */
export const getActiveStoreId = async () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      if (storedUser?.storeId) return storedUser.storeId;
    }
    if (db && db.settings) {
      const setting = await db.settings.get(1);
      if (setting?.storeId) return setting.storeId;
    }
    return null;
  } catch (err) {
    console.warn('[storeHelper] Gagal mengambil storeId:', err);
    return null;
  }
};

/**
 * Mengambil storeId aktif secara synchronous dari sessionStorage saja
 */
export const getActiveStoreIdSync = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
      return storedUser?.storeId || null;
    }
    return null;
  } catch {
    return null;
  }
};
