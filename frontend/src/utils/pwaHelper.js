/**
 * Utilitas PWA Helper: Menangani dynamic manifest dan instalasi PWA di Android / Desktop
 */

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3000/api';

let deferredPrompt = null;
const installListeners = new Set();

// Inisialisasi listener event beforeinstallprompt
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Cegah mini-infobar default browser agar bisa dikontrol secara custom
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((listener) => {
      try {
        listener(deferredPrompt);
      } catch (err) {
        console.warn('[PWA] Listener error:', err);
      }
    });
    window.dispatchEvent(new CustomEvent('pwa:install-ready', { detail: { prompt: e } }));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((listener) => {
      try {
        listener(null);
      } catch (err) {
        console.warn('[PWA] Listener error:', err);
      }
    });
    window.dispatchEvent(new CustomEvent('pwa:installed'));
  });
}

/**
 * Mendaftarkan callback saat prompt install tersedia
 */
export function onInstallPromptChange(callback) {
  installListeners.add(callback);
  // Panggil segera dengan status saat ini
  callback(deferredPrompt);
  return () => installListeners.delete(callback);
}

/**
 * Mendapatkan deferred prompt yang tersimpan
 */
export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

/**
 * Memicu dialog install PWA bawaan browser
 */
export async function promptPwaInstall() {
  if (!deferredPrompt) {
    return { outcome: 'unavailable', message: 'Prompt install otomatis tidak didukung oleh browser ini atau aplikasi sudah terpasang.' };
  }

  try {
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return choiceResult;
  } catch (err) {
    console.warn('[PWA] Error prompt install:', err);
    return { outcome: 'dismissed', error: err };
  }
}

/**
 * Memperbarui Web App Manifest secara dinamis sesuai nama toko
 * @param {string} storeName - Nama toko laundry
 */
export function updatePwaManifest(storeName) {
  if (typeof document === 'undefined' || !storeName || !storeName.trim()) {
    return;
  }

  try {
    const cleanName = storeName.trim();
    const shortName = cleanName.length > 15 ? cleanName.slice(0, 15) : cleanName;

    // Simpan ke storage untuk persistensi reload cepat
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pwa_custom_store_name', cleanName);
    }

    const manifestData = {
      name: cleanName,
      short_name: shortName,
      description: `Aplikasi Kasir Laundry - ${cleanName}`,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#ffffff',
      theme_color: '#0134d4',
      icons: [
        {
          src: '/img/core-img/favicon.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestJson = JSON.stringify(manifestData);
    const dataUri = `data:application/manifest+json;charset=utf-8,${encodeURIComponent(manifestJson)}`;

    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    manifestLink.setAttribute('href', dataUri);
  } catch (err) {
    console.warn('[PWA] Gagal memperbarui dynamic manifest:', err);
  }
}

/**
 * Mengambil info toko dari backend API
 * @param {string} storeCode - Kode unik toko
 */
export async function fetchStoreInfoByCode(storeCode) {
  if (!storeCode || !storeCode.trim()) return null;

  try {
    const cleanCode = storeCode.trim().toUpperCase();
    const res = await fetch(`${API_BASE_URL}/auth/store-info?code=${encodeURIComponent(cleanCode)}`);
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (err) {
    console.warn('[PWA] Gagal mengambil store info dari API:', err);
    return null;
  }
}
