import { db } from '../db.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Mask nomor telepon untuk privasi publik pelanggan (misal: 081234567890 -> 0812****890)
 */
export const maskPhoneNumber = (phone) => {
  if (!phone) return '-';
  const clean = String(phone).trim();
  if (clean.length <= 7) return clean;
  return clean.substring(0, 4) + '****' + clean.substring(clean.length - 3);
};

/**
 * Encode nomor nota / invoiceId menjadi URL-safe short code
 */
export const encodeTrackingCode = (invoiceId) => {
  if (!invoiceId) return '';
  const trimmed = String(invoiceId).trim();
  try {
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(trimmed).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return Buffer.from(trimmed).toString('base64url');
  } catch {
    return trimmed;
  }
};

/**
 * Decode URL-safe short code menjadi invoiceId asli
 */
export const decodeTrackingCode = (code) => {
  if (!code) return '';
  const trimmed = String(code).trim();
  try {
    let base64 = trimmed.replace(/\./g, '=').replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    let decoded = '';
    if (typeof window !== 'undefined' && window.atob) {
      decoded = window.atob(base64);
    } else {
      decoded = Buffer.from(base64, 'base64').toString('utf-8');
    }
    // Pastikan hasil decode adalah string karakter nota yang valid
    if (decoded && /^[\w\s.-]+$/.test(decoded) && decoded.length >= 2 && decoded.length <= 64) {
      return decoded;
    }
  } catch {
    // Jika bukan base64, gunakan string apa adanya
  }
  return trimmed;
};

/**
 * Buat link lengkap pelacakan order
 */
export const getTrackingUrl = (invoiceId, explicitOrigin = null) => {
  if (!invoiceId) return '';
  const shortCode = encodeTrackingCode(invoiceId);
  const defaultDomain = import.meta.env?.VITE_PUBLIC_TRACKING_URL || 'https://kasir-laundry-frontend.onrender.com';
  const origin = explicitOrigin || (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost') ? window.location.origin : defaultDomain);
  return `${origin.replace(/\/+$/, '')}/c/${shortCode}`;
};

/**
 * Buat link ringkas untuk tampilan struk atau teks chat
 */
export const getShortDisplayUrl = (invoiceId, domain = null) => {
  if (!invoiceId) return '';
  const shortCode = encodeTrackingCode(invoiceId);
  const host = domain || (typeof window !== 'undefined' && window.location?.host ? window.location.host : 'kasirlaundry.my.id');
  return `${host}/c/${shortCode}`;
};

/**
 * Ambil data pelacakan order publik secara cerdas (Sync antara Dexie lokal dan Backend API)
 */
export const fetchPublicOrder = async (code) => {
  if (!code || !code.trim()) {
    throw new Error('Kode pelacakan atau nomor nota wajib diisi');
  }

  const rawCode = code.trim();
  const decodedInvoice = decodeTrackingCode(rawCode);

  // 1. Coba cari di Dexie lokal terlebih dahulu (untuk akses instan & mode offline kasir/device)
  let localFormatted = null;
  try {
    const candidates = [decodedInvoice, rawCode, decodedInvoice.toUpperCase(), rawCode.toUpperCase()];
    let localOrder = null;
    for (const cand of candidates) {
      localOrder = await db.orders.where('invoiceId').equals(cand).first();
      if (!localOrder && cand.includes('-')) {
        localOrder = await db.orders.where('uuid').equals(cand).first();
      }
      if (localOrder) break;
    }

    if (localOrder && !localOrder.deletedAt) {
      let localPelanggan = null;
      if (localOrder.pelangganId) {
        localPelanggan = await db.pelanggan.get(localOrder.pelangganId);
        if (!localPelanggan && typeof localOrder.pelangganId === 'string') {
          localPelanggan = await db.pelanggan.where('uuid').equals(localOrder.pelangganId).first();
        }
      }
      const localSettings = await db.settings.get(1);

      localFormatted = {
        id: localOrder.uuid || String(localOrder.id),
        storeId: localOrder.storeId || localSettings?.storeId || '',
        invoiceId: localOrder.invoiceId,
        shortCode: encodeTrackingCode(localOrder.invoiceId),
        status: localOrder.status || 'Baru',
        statusBayar: localOrder.statusBayar || 'Belum Lunas',
        metodeBayar: localOrder.metodeBayar || 'Tunai',
        total: localOrder.total,
        diskon: localOrder.diskon || 0,
        bayar: localOrder.bayar || 0,
        kembalian: localOrder.kembalian || 0,
        estimasi: localOrder.estimasi || '2',
        tipeLayanan: localOrder.tipeLayanan || 'Kiloan',
        isPriority: !!localOrder.isPriority,
        catatan: localOrder.catatan || '',
        createdAt: localOrder.createdAt,
        updatedAt: localOrder.updatedAt,
        items: localOrder.items || [],
        pelanggan: {
          id: localPelanggan?.id,
          nama: localPelanggan?.nama || 'Pelanggan Umum',
          hp: maskPhoneNumber(localPelanggan?.hp),
          alamat: localPelanggan?.alamat || '',
        },
        store: {
          name: localSettings?.namaLaundry || 'Kasir Laundry',
          motto: localSettings?.motto || 'Solusi Laundry Bersih & Cepat',
          address: localSettings?.alamat || '',
          city: localSettings?.kota || '',
          phone: localSettings?.telepon || '',
          jamBuka: localSettings?.jamBuka || '08.00 - 17.00',
        },
        fromLocal: true,
      };
    }
  } catch (dexieErr) {
    console.warn('[Tracking] Gagal membaca Dexie:', dexieErr);
  }

  // 2. Jika online, lakukan sinkronisasi / fetch ke Backend API resmi
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/check/${encodeURIComponent(rawCode)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const json = await response.json();
        const serverOrder = json.data;

        // Simpan ke cache localStorage untuk fallback offline di browser pelanggan
        try {
          localStorage.setItem(`tracked_order_${serverOrder.invoiceId}`, JSON.stringify(serverOrder));
          localStorage.setItem(`tracked_order_${serverOrder.shortCode}`, JSON.stringify(serverOrder));
        } catch { }

        return {
          order: serverOrder,
          isOffline: false,
          source: 'server',
        };
      } else if (response.status === 404) {
        // Jika server mengembalikan 404 tapi ada data lokal di Dexie
        if (localFormatted) {
          return {
            order: localFormatted,
            isOffline: false,
            source: 'local-only',
          };
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Pesanan dengan kode "${code}" tidak ditemukan`);
      }
    } catch (netErr) {
      // Jika request gagal karena koneksi / server down, fallback ke data lokal/cache
      if (localFormatted) {
        return {
          order: localFormatted,
          isOffline: true,
          source: 'dexie-offline',
        };
      }
    }
  }

  // 3. Fallback jika offline: periksa data Dexie atau cache localStorage
  if (localFormatted) {
    return {
      order: localFormatted,
      isOffline: true,
      source: 'dexie-offline',
    };
  }

  // Cek cache localStorage (khususnya untuk browser pelanggan luar yang pernah membuka link ini)
  try {
    const cachedStr =
      localStorage.getItem(`tracked_order_${rawCode}`) ||
      localStorage.getItem(`tracked_order_${decodedInvoice}`);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      return {
        order: cached,
        isOffline: true,
        source: 'cache-offline',
      };
    }
  } catch { }

  throw new Error(
    `Pesanan "${code}" belum tersimpan di memori perangkat. Silakan hubungkan internet untuk memuat data dari server.`
  );
};

