const STORAGE_KEY_OFFLINE_SINCE = 'kasir_offline_since';
const STORAGE_KEY_LAST_ONLINE = 'kasir_last_online_at';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Memperbarui status konektivitas saat ini
 */
export function updateConnectivityState() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const now = Date.now();

  if (isOnline) {
    localStorage.setItem(STORAGE_KEY_LAST_ONLINE, String(now));
    localStorage.removeItem(STORAGE_KEY_OFFLINE_SINCE);
  } else {
    const existingOfflineSince = localStorage.getItem(STORAGE_KEY_OFFLINE_SINCE);
    if (!existingOfflineSince) {
      // Jika sebelumnya ada last online, gunakan itu atau waktu sekarang
      const lastOnline = localStorage.getItem(STORAGE_KEY_LAST_ONLINE);
      const offlineStart = lastOnline ? parseInt(lastOnline, 10) : now;
      localStorage.setItem(STORAGE_KEY_OFFLINE_SINCE, String(offlineStart));
    }
  }
}

/**
 * Menghitung berapa lama perangkat kasir telah offline (dalam milidetik)
 */
export function getOfflineDurationMs() {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    return 0;
  }

  const offlineSinceStr = localStorage.getItem(STORAGE_KEY_OFFLINE_SINCE);
  if (!offlineSinceStr) {
    return 0;
  }

  const offlineSince = parseInt(offlineSinceStr, 10);
  if (isNaN(offlineSince)) {
    return 0;
  }

  return Math.max(0, Date.now() - offlineSince);
}

/**
 * Mengecek apakah perangkat offline sudah lebih dari atau sama dengan 3 hari
 */
export function isOfflineExceeded3Days() {
  return getOfflineDurationMs() >= THREE_DAYS_MS;
}

/**
 * Inisialisasi event listener konektivitas online/offline
 */
export function initOfflineGuardListener() {
  if (typeof window === 'undefined') return;

  updateConnectivityState();

  window.addEventListener('online', () => {
    updateConnectivityState();
    window.dispatchEvent(new CustomEvent('connectivityChanged', { detail: { online: true } }));
  });

  window.addEventListener('offline', () => {
    updateConnectivityState();
    window.dispatchEvent(new CustomEvent('connectivityChanged', { detail: { online: false } }));
  });
}

