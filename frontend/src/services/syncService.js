import { db } from '../db.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Format order Dexie menjadi payload DTO NestJS
 */
const formatOrderPayload = async (order) => {
  let pelanggan = null;
  if (order.pelangganId) {
    pelanggan = await db.pelanggan.get(order.pelangganId);
  }

  // Dapatkan Store ID agar data terisolasi per toko (Multi-store isolation)
  const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const setting = await db.settings.get(1);
  const storeId = order.storeId || storedUser.storeId || setting?.storeId || undefined;

  const items = (order.cartItems || []).map(item => ({
    productId: item.uuid || (item.id ? String(item.id) : undefined),
    name: item.name,
    quantity: Number(item.quantity) || 1,
    price: Number(item.price) || 0,
    subtotal: (Number(item.quantity) || 1) * (Number(item.price) || 0)
  }));

  return {
    id: order.uuid || crypto.randomUUID(),
    storeId,
    invoiceId: order.invoiceId,
    userId: storedUser.uuid || (order.userId ? String(order.userId) : undefined),
    pelangganId: pelanggan?.uuid || undefined,
    pelanggan: pelanggan ? {
      id: pelanggan.uuid,
      nama: pelanggan.nama,
      hp: pelanggan.hp,
      alamat: pelanggan.alamat
    } : (order.pelangganNama ? {
      nama: order.pelangganNama,
      hp: order.pelangganHp || '-',
      alamat: order.pelangganAlamat
    } : undefined),
    total: order.total,
    diskon: order.diskon || 0,
    bayar: order.bayar || 0,
    kembalian: order.kembalian || 0,
    metodeBayar: order.metodeBayar || 'Tunai',
    estimasi: order.estimasi,
    tipeLayanan: order.tipeLayanan,
    isPriority: Boolean(order.isPriority),
    statusBayar: order.statusBayar,
    status: order.status,
    catatan: order.catatan,
    inventoryUsed: order.inventoryUsed,
    items,
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : new Date().toISOString(),
    deletedAt: order.deletedAt ? new Date(order.deletedAt).toISOString() : null
  };
};

/**
 * Sinkronisasi single order ke backend NestJS
 */
export const syncOrderToBackend = async (orderId) => {
  try {
    const order = await db.orders.get(parseInt(orderId));
    if (!order) return;

    // Jika belum punya uuid, tambahkan
    if (!order.uuid) {
      const uuid = crypto.randomUUID();
      await db.orders.update(order.id, { uuid });
      order.uuid = uuid;
    }

    const payload = await formatOrderPayload(order);

    const response = await fetch(`${API_BASE_URL}/orders/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Tandai data lokal sudah ter-sync
      await db.orders.update(order.id, { isDirty: 0 });
      console.log(`[Sync] Order ${order.invoiceId} berhasil disinkronkan ke BE.`);
      return true;
    } else {
      console.warn(`[Sync] Gagal sync order ${order.invoiceId}: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    // Offline atau backend tidak aktif: biarkan isDirty: 1 agar di-retry nanti
    console.warn(`[Sync] Backend tidak terjangkau (Offline mode): ${error.message}`);
    return false;
  }
};

let isSyncing = false;

/**
 * Sinkronisasi User/Kasir yang berubah (isDirty: 1) ke Backend
 */
export const syncUsersToBackend = async () => {
  try {
    const dirtyUsers = await db.users.filter(u => u.isDirty === 1 || !u.uuid).toArray();
    if (dirtyUsers.length === 0) return;

    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId || undefined;

    const payloads = [];
    for (const u of dirtyUsers) {
      if (!u.uuid) {
        u.uuid = crypto.randomUUID();
        await db.users.update(u.id, { uuid: u.uuid });
      }
      payloads.push({
        id: u.uuid,
        storeId,
        username: u.username,
        password: u.password,
        fullname: u.fullname || u.username,
        role: u.role || 'kasir',
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : new Date().toISOString(),
        deletedAt: u.deletedAt ? new Date(u.deletedAt).toISOString() : null,
      });
    }

    const response = await fetch(`${API_BASE_URL}/sync/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      for (const u of dirtyUsers) {
        await db.users.update(u.id, { isDirty: 0 });
      }
      console.log(`[Sync] ${dirtyUsers.length} user berhasil disinkronkan ke BE.`);
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync users (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi Produk/Layanan ke Backend (Bisa dipaksa semua produk saat start awal)
 */
export const syncProductsToBackend = async (forceAll = false) => {
  try {
    const productsToSync = forceAll
      ? await db.products.toArray()
      : await db.products.filter(p => p.isDirty === 1 || !p.uuid || typeof p.isDirty === 'undefined').toArray();

    if (productsToSync.length === 0) return;

    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    let setting = await db.settings.get(1);
    let storeId = storedUser.storeId || setting?.storeId;

    if (!storeId) {
      return;
    }

    const payloads = [];
    for (const p of productsToSync) {
      if (!p.uuid) {
        p.uuid = crypto.randomUUID();
        await db.products.update(p.id, { uuid: p.uuid });
      }
      payloads.push({
        id: p.uuid,
        storeId,
        code: p.code || null,
        category: p.category || null,
        name: p.name,
        price: Number(p.price) || 0,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        deletedAt: p.deletedAt ? new Date(p.deletedAt).toISOString() : null,
      });
    }

    const response = await fetch(`${API_BASE_URL}/sync/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      for (const p of productsToSync) {
        await db.products.update(p.id, { isDirty: 0 });
      }
      console.log(`[Sync] ${productsToSync.length} produk berhasil disinkronkan ke BE.`);
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync products (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi Pelanggan / Customer ke Backend
 */
export const syncPelangganToBackend = async (forceAll = false) => {
  try {
    const pelangganList = forceAll
      ? await db.pelanggan.toArray()
      : await db.pelanggan.filter(p => p.isDirty === 1 || !p.uuid || typeof p.isDirty === 'undefined').toArray();

    if (pelangganList.length === 0) return;

    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;

    if (!storeId) return;

    const payloads = [];
    for (const p of pelangganList) {
      if (!p.uuid) {
        p.uuid = crypto.randomUUID();
        await db.pelanggan.update(p.id, { uuid: p.uuid });
      }
      payloads.push({
        id: p.uuid,
        storeId,
        nama: p.nama,
        hp: p.hp,
        alamat: p.alamat || null,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
        deletedAt: p.deletedAt ? new Date(p.deletedAt).toISOString() : null,
      });
    }

    const response = await fetch(`${API_BASE_URL}/sync/pelanggan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      for (const p of pelangganList) {
        await db.pelanggan.update(p.id, { isDirty: 0 });
      }
      console.log(`[Sync] ${pelangganList.length} pelanggan berhasil disinkronkan ke BE.`);
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync pelanggan (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi Pengaturan Toko / Settings yang berubah (isDirty: 1) ke Backend
 */
export const syncSettingsToBackend = async () => {
  try {
    const setting = await db.settings.get(1);
    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const storeId = setting?.storeId || storedUser.storeId;

    // Jangan push settings ke server jika belum punya storeId (belum login / belum register)
    if (!storeId || (setting.isDirty !== 1 && setting.storeId)) return;

    const payload = {
      storeId,
      namaLaundry: setting.namaLaundry,
      motto: setting.motto,
      alamat: setting.alamat,
      kota: setting.kota,
      telepon: setting.telepon,
      jamBuka: setting.jamBuka,
      menerimaCucian: setting.menerimaCucian,
      headerStruk: setting.headerStruk,
      footerStruk: setting.footerStruk,
      updatedAt: setting.updatedAt ? new Date(setting.updatedAt).toISOString() : new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/sync/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const serverStoreId = result.data?.storeId;
      await db.settings.update(1, { isDirty: 0, storeId: serverStoreId || storeId });
      console.log(`[Sync] Settings toko berhasil disinkronkan ke BE.`);
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync settings (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi seluruh master data (Users, Products, Pelanggan, Settings)
 */
export const syncAllDirtyMasterData = async (forceAll = false) => {
  const setting = await db.settings.get(1);
  const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  // Hanya jalankan sync jika sudah memiliki storeId resmi
  if (!setting?.storeId && !storedUser?.storeId) {
    return;
  }

  await syncSettingsToBackend();
  await syncUsersToBackend();
  await syncProductsToBackend(forceAll);
  await syncPelangganToBackend(forceAll);
};

/**
 * Sinkronisasi seluruh order yang belum ter-sync (isDirty: 1)
 */
export const syncDirtyOrders = async () => {
  // Cegah multiple sync bersamaan (Concurrency Lock)
  if (isSyncing) return;

  try {
    isSyncing = true;

    // Sinkronkan master data (Users, Products, Settings) dulu jika ada perubahan
    await syncAllDirtyMasterData();

    // Cek dulu apakah ada order yang kotor (Early exit jika tidak ada, 0 overhead)
    const dirtyOrders = await db.orders.filter(o => o.isDirty === 1 || typeof o.isDirty === 'undefined').toArray();
    if (dirtyOrders.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[Sync] Menemukan ${dirtyOrders.length} order pending untuk disinkronkan...`);

    const payloads = [];
    for (const order of dirtyOrders) {
      if (!order.uuid) {
        order.uuid = crypto.randomUUID();
        await db.orders.update(order.id, { uuid: order.uuid });
      }
      payloads.push(await formatOrderPayload(order));
    }

    const response = await fetch(`${API_BASE_URL}/orders/sync-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.results) {
        for (const res of result.results) {
          if (res.status === 'success') {
            const ord = dirtyOrders.find(o => o.uuid === res.id);
            if (ord) {
              await db.orders.update(ord.id, { isDirty: 0 });
            }
          }
        }
      }
      console.log('[Sync] Batch sync selesai.');
    }
  } catch (error) {
    console.warn(`[Sync] Gagal batch sync (offline/server unreachable): ${error.message}`);
  } finally {
    isSyncing = false;
  }
};

// Inisialisasi auto-sync saat koneksi kembali online dan interval background
if (typeof window !== 'undefined') {
  const isAutoSyncEnabled = import.meta.env.VITE_ENABLE_AUTO_SYNC !== 'false';
  // Default: 10 menit (600.000 ms) agar aplikasi sangat ringan & bebas lag
  const syncInterval = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '600000', 10);

  if (isAutoSyncEnabled) {
    // 1. Sync instan saat internet kembali menyala
    window.addEventListener('online', () => {
      console.log('[Sync] Jaringan online terdeteksi, memulai sinkronisasi...');
      syncDirtyOrders();
    });

    // 2. Cek sekali saat pertama kali aplikasi dibuka (Paksa sync seluruh master data termasuk Produk & Pelanggan)
    if (navigator.onLine) {
      setTimeout(() => {
        syncAllDirtyMasterData(true);
        syncDirtyOrders();
      }, 2000);
    }

    // 3. Periodic background sync (Hanya berjalan jika tab aktif & browser online)
    if (syncInterval > 0) {
      setInterval(() => {
        if (navigator.onLine && (!document.hidden || document.visibilityState === 'visible')) {
          syncDirtyOrders();
        }
      }, syncInterval);
    }
  }
}



