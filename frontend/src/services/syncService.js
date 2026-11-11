import { db } from '../db.js';
import { syncPlansFromBackend } from '../db/repositories/plans.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Mengambil User aktif dari storage browser (sessionStorage / localStorage)
 */
export const getStoredUser = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem('user') ||
      localStorage.getItem('user') ||
      '{}'
    );
  } catch {
    return {};
  }
};

/**
 * Mengambil JWT Bearer Token dari storage browser (sessionStorage / localStorage / user)
 */
/**
 * Helper untuk mendeteksi apakah rute aktif saat ini adalah rute publik (tidak perlu sinkronisasi data privat)
 */
export const isPublicRoute = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return (
    path === '/daftar-toko' ||
    path === '/register-store' ||
    path === '/login' ||
    path === '/register' ||
    path === '/reset' ||
    path === '/reset-cache' ||
    path.startsWith('/c/')
  );
};

export const getAuthToken = () => {
  try {
    return (
      sessionStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      getStoredUser()?.token ||
      null
    );
  } catch {
    return null;
  }
};

/**
 * Helper pembentuk HTTP Headers lengkap dengan Authorization: Bearer <token>
 */
export const getAuthHeaders = (extraHeaders = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};


/**
 * Format order Dexie menjadi payload DTO NestJS
 */
const formatOrderPayload = async (order) => {
  let pelanggan = null;
  if (order.pelangganId) {
    if (typeof order.pelangganId === 'number' || (typeof order.pelangganId === 'string' && /^\d+$/.test(order.pelangganId))) {
      pelanggan = await db.pelanggan.get(parseInt(order.pelangganId, 10));
    }
    if (!pelanggan && typeof order.pelangganId === 'string') {
      pelanggan = await db.pelanggan.where('uuid').equals(order.pelangganId).first();
    }
  }
  if (!pelanggan && order.pelangganNama) {
    pelanggan = await db.pelanggan.filter(p => !p.deletedAt && p.nama && p.nama.toLowerCase().trim() === order.pelangganNama.toLowerCase().trim()).first();
  }

  // Dapatkan Store ID agar data terisolasi per toko (Multi-store isolation)
  const storedUser = getStoredUser();
  const setting = await db.settings.get(1);
  const storeId = order.storeId || storedUser.storeId || setting?.storeId || undefined;

  const rawItems = order.items || order.cartItems || [];
  const items = [];

  for (const item of rawItems) {
    let finalProductId = item.productId || null;

    // Jika productId berupa number atau integer string (data lokal Dexie lama), lookup UUID produk
    if (finalProductId && typeof finalProductId === 'number') {
      const prod = await db.products.get(finalProductId);
      if (prod?.uuid) {
        finalProductId = prod.uuid;
      }
    } else if (finalProductId && typeof finalProductId === 'string' && !finalProductId.includes('-')) {
      const numId = parseInt(finalProductId, 10);
      if (!isNaN(numId)) {
        const prod = await db.products.get(numId);
        if (prod?.uuid) {
          finalProductId = prod.uuid;
        }
      }
    }

    // Resolusi fallback jika productId belum terisi: cocokkan nama produk dengan db.products lokal
    let itemName = item.name || 'Layanan Laundry';
    if (!finalProductId && item.name) {
      const allProds = await db.products.toArray();
      const cleanItemName = item.name.trim().toLowerCase();
      const matchedProd = allProds.find((p) => {
        const full = `${p.category || ''} - ${p.name || ''}`.trim().toLowerCase();
        const space = `${p.category || ''} ${p.name || ''}`.trim().toLowerCase();
        const pure = (p.name || '').trim().toLowerCase();
        return (
          full === cleanItemName ||
          space === cleanItemName ||
          pure === cleanItemName ||
          (p.code && p.code.toLowerCase() === cleanItemName)
        );
      });

      if (matchedProd) {
        if (!matchedProd.uuid) {
          matchedProd.uuid = crypto.randomUUID();
          await db.products.update(matchedProd.id, { uuid: matchedProd.uuid });
        }
        finalProductId = matchedProd.uuid;
        if (matchedProd.category && !itemName.includes('-')) {
          itemName = `${matchedProd.category} - ${matchedProd.name}`;
        }
      }
    }

    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const subtotal = Number(item.subtotal) || (qty * price);

    items.push({
      id: item.uuid || undefined,
      productId: finalProductId || undefined,
      name: itemName,
      quantity: qty,
      price: price,
      subtotal: subtotal,
    });
  }

  // Resolve userId: pastikan yang dikirim adalah UUID user di PostgreSQL
  let finalUserId = order.userId || storedUser.uuid;
  if (finalUserId && typeof finalUserId === 'number') {
    const localU = await db.users.get(finalUserId);
    if (localU?.uuid) finalUserId = localU.uuid;
  } else if (finalUserId && typeof finalUserId === 'string' && !finalUserId.includes('-')) {
    const numId = parseInt(finalUserId, 10);
    if (!isNaN(numId)) {
      const localU = await db.users.get(numId);
      if (localU?.uuid) finalUserId = localU.uuid;
    }
  }

  if ((!finalUserId || typeof finalUserId !== 'string' || !finalUserId.includes('-')) && storedUser?.uuid) {
    finalUserId = storedUser.uuid;
  }

  if (!finalUserId || typeof finalUserId !== 'string' || !finalUserId.includes('-')) {
    const firstLocalUser = (storeId ? await db.users.where('storeId').equals(storeId).first() : null) || await db.users.first();
    if (firstLocalUser?.uuid) {
      finalUserId = firstLocalUser.uuid;
    }
  }

  return {
    id: order.uuid || crypto.randomUUID(),
    storeId,
    invoiceId: order.invoiceId,
    userId: finalUserId || undefined,
    pelangganId: pelanggan?.uuid || (typeof order.pelangganId === 'string' && order.pelangganId.includes('-') ? order.pelangganId : undefined),
    pelanggan: pelanggan ? {
      id: pelanggan.uuid,
      nama: pelanggan.nama,
      hp: pelanggan.hp || '-',
      alamat: pelanggan.alamat || '-'
    } : (order.pelangganNama ? {
      nama: order.pelangganNama,
      hp: order.pelangganHp || '-',
      alamat: order.pelangganAlamat || '-'
    } : undefined),
    total: order.total,
    diskon: order.diskon || 0,
    bayar: order.bayar || 0,
    kembalian: order.kembalian || 0,
    metodeBayar: order.metodeBayar || 'Tunai',
    estimasi: order.estimasi !== undefined && order.estimasi !== null ? String(order.estimasi) : null,
    tipeLayanan: order.tipeLayanan,
    isPriority: Boolean(order.isPriority),
    statusBayar: order.statusBayar,
    status: order.status,
    catatan: order.catatan,
    catatanKasir: order.catatanKasir || null,
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
    let order = null;
    const numId = parseInt(orderId, 10);
    if (!isNaN(numId)) {
      order = await db.orders.get(numId);
    }
    if (!order && typeof orderId === 'string') {
      order = (await db.orders.where('uuid').equals(orderId).first()) ||
        (await db.orders.where('invoiceId').equals(orderId).first());
    }
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      const serverOrder = result.data || result;
      const updateData = { isDirty: 0 };
      if (serverOrder && serverOrder.inventoryUsed) {
        updateData.inventoryUsed = serverOrder.inventoryUsed;
      }
      if (serverOrder && serverOrder.id) {
        updateData.uuid = serverOrder.id;
      }
      if (serverOrder && serverOrder.storeId) {
        updateData.storeId = serverOrder.storeId;
      }
      updateData.deletedAt = serverOrder?.deletedAt ? new Date(serverOrder.deletedAt) : null;
      if (serverOrder && serverOrder.updatedAt) {
        updateData.updatedAt = new Date(serverOrder.updatedAt);
      }
      await db.orders.update(order.id, updateData);
      return true;
    } else {
      if (response.status === 401) {
        console.warn(`[Sync] Gagal sync order ${order.invoiceId}: 401 Unauthorized (Bearer token tidak valid / kedaluwarsa)`);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      } else {
        console.warn(`[Sync] Gagal sync order ${order.invoiceId}: HTTP ${response.status}`);
      }
      return false;
    }
  } catch (error) {
    // Offline atau backend tidak aktif: biarkan isDirty: 1 agar di-retry nanti
    console.warn(`[Sync] Backend tidak terjangkau (Offline mode): ${error.message}`);
    return false;
  }
};

let isSyncing = false;
let isMasterSyncing = false;

/**
 * Sinkronisasi User/Kasir yang berubah (isDirty: 1) ke Backend
 */
export const syncUsersToBackend = async () => {
  try {
    const dirtyUsers = await db.users.filter(u => u.isDirty === 1).toArray();
    if (dirtyUsers.length === 0) return;

    const storedUser = getStoredUser();
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const serverUsers = await response.json().catch(() => []);
      for (const u of dirtyUsers) {
        const match = Array.isArray(serverUsers)
          ? serverUsers.find(su => su.id === u.uuid || su.username === u.username)
          : null;
        await db.users.update(u.id, {
          isDirty: 0,
          ...(match ? { uuid: match.id } : {}),
        });
      }
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync users (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi Produk/Layanan ke Backend (Bisa dipaksa semua produk saat start awal jika DB server masih kosong)
 */
export const syncProductsToBackend = async (forceAll = false) => {
  try {
    const productsToSync = forceAll
      ? await db.products.toArray()
      : await db.products.filter(p => p.isDirty === 1).toArray();

    if (productsToSync.length === 0) return;

    const storedUser = getStoredUser();
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const serverProducts = await response.json().catch(() => []);
      for (const p of productsToSync) {
        const match = Array.isArray(serverProducts)
          ? serverProducts.find(sp => sp.id === p.uuid || (p.code && sp.code === p.code) || sp.name === p.name)
          : null;
        await db.products.update(p.id, {
          isDirty: 0,
          storeId,
          ...(match ? { uuid: match.id } : {}),
        });
      }
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
      : await db.pelanggan.filter(p => p.isDirty === 1).toArray();

    if (pelangganList.length === 0) return;

    const storedUser = getStoredUser();
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const serverResult = await response.json().catch(() => ({}));
      const serverPelanggan = serverResult.data || serverResult || [];
      for (const p of pelangganList) {
        const match = Array.isArray(serverPelanggan)
          ? serverPelanggan.find(sp => sp.id === p.uuid || (p.hp && sp.hp === p.hp) || sp.nama === p.nama)
          : null;
        await db.pelanggan.update(p.id, {
          isDirty: 0,
          storeId,
          ...(match ? { uuid: match.id } : {}),
        });
      }
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
    const storedUser = getStoredUser();
    const storeId = setting?.storeId || storedUser.storeId;

    // HANYA sinkronkan jika setting berstatus kotor (isDirty: 1) dan memiliki storeId
    if (!storeId || setting?.isDirty !== 1) {
      return;
    }

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
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const serverStoreId = result.data?.storeId;
      await db.settings.update(1, { isDirty: 0, storeId: serverStoreId || storeId });
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync settings (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi Inventory / Stok Bahan yang berubah (isDirty: 1) ke Backend
 */
export const syncInventoryToBackend = async (forceAll = false) => {
  try {
    const dirtyInventory = forceAll
      ? await db.inventory.toArray()
      : await db.inventory.filter(i => i.isDirty === 1).toArray();

    if (dirtyInventory.length === 0) return;

    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;

    if (!storeId) return;

    const payloads = [];
    for (const inv of dirtyInventory) {
      if (!inv.uuid) {
        inv.uuid = crypto.randomUUID();
        await db.inventory.update(inv.id, { uuid: inv.uuid });
      }
      payloads.push({
        id: inv.uuid,
        storeId,
        nama: inv.nama,
        stok: Number(inv.stok) || 0,
        qty: Number(inv.qty) || 0,
        unit: inv.unit || null,
        status: inv.status || 'approved',
        createdBy: inv.createdBy || null,
        createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: inv.updatedAt ? new Date(inv.updatedAt).toISOString() : new Date().toISOString(),
        deletedAt: inv.deletedAt ? new Date(inv.deletedAt).toISOString() : null,
      });
    }

    const response = await fetch(`${API_BASE_URL}/sync/inventory`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const serverResult = await response.json().catch(() => ({}));
      const serverItems = serverResult.data || serverResult || [];
      for (const inv of dirtyInventory) {
        const match = Array.isArray(serverItems)
          ? serverItems.find(si => si.id === inv.uuid || si.nama.toLowerCase() === inv.nama.toLowerCase())
          : null;
        await db.inventory.update(inv.id, {
          isDirty: 0,
          storeId,
          ...(match ? { uuid: match.id } : {}),
        });
      }
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync inventory (offline): ${err.message}`);
  }
};


/**
 * Sinkronisasi InventoryEvents (mutasi pergerakan stok) yang berubah ke Backend
 */
export const syncInventoryEventsToBackend = async (forceAll = false) => {
  if (isPublicRoute() || !getAuthToken()) return;
  try {
    const dirtyEvents = forceAll
      ? await db.inventoryEvents.toArray()
      : await db.inventoryEvents.filter(e => e.isDirty === 1).toArray();

    if (dirtyEvents.length === 0) return;

    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;

    if (!storeId) return;

    const payloads = [];
    for (const evt of dirtyEvents) {
      if (!evt.uuid) {
        evt.uuid = crypto.randomUUID();
        await db.inventoryEvents.update(evt.id, { uuid: evt.uuid });
      }

      let invName = evt.inventoryName;
      if (!invName && evt.inventoryId) {
        const numId = parseInt(evt.inventoryId, 10);
        let item = !isNaN(numId) ? await db.inventory.get(numId) : null;
        if (!item) {
          item = await db.inventory.where('uuid').equals(String(evt.inventoryId)).first();
        }
        if (item?.nama) {
          invName = item.nama;
          await db.inventoryEvents.update(evt.id, { inventoryName: invName });
        }
      }

      let invId = evt.invoiceId;
      if (!invId && evt.note) {
        const m = evt.note.match(/([A-Za-z0-9]{4}-d{5})/);
        if (m) {
          invId = m[1];
          await db.inventoryEvents.update(evt.id, { invoiceId: invId });
        }
      }

      payloads.push({
        id: evt.uuid,
        storeId,
        inventoryId: evt.inventoryId ? String(evt.inventoryId) : null,
        inventoryName: invName || null,
        type: evt.type || 'ADD',
        qty: Number(evt.qty) || 0,
        note: evt.note || null,
        invoiceId: invId || null,
        createdBy: evt.createdBy || null,
        kasirPengaju: evt.kasirPengaju || null,
        createdAt: evt.createdAt ? new Date(evt.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: evt.updatedAt ? new Date(evt.updatedAt).toISOString() : new Date().toISOString(),
        deletedAt: evt.deletedAt ? new Date(evt.deletedAt).toISOString() : null,
      });
    }

    const response = await fetch(`${API_BASE_URL}/sync/inventory-events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const serverResult = await response.json().catch(() => ({}));
      const serverItems = serverResult.data || serverResult || [];
      for (const evt of dirtyEvents) {
        const match = Array.isArray(serverItems)
          ? serverItems.find(se => se.id === evt.uuid)
          : null;
        await db.inventoryEvents.update(evt.id, {
          isDirty: 0,
          storeId,
          ...(match ? { uuid: match.id } : {}),
        });
      }
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync inventory events (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi seluruh master data (Users, Products, Pelanggan, Settings, Inventory)
 */
export const syncAllDirtyMasterData = async (forceAll = false) => {
  if (isPublicRoute() || !getAuthToken()) return;
  if (isMasterSyncing) return;

  try {
    isMasterSyncing = true;
    const setting = await db.settings.get(1);
    const storedUser = getStoredUser();
    // Hanya jalankan sync jika sudah memiliki storeId resmi
    if (!setting?.storeId && !storedUser?.storeId) {
      return;
    }

    await syncSettingsToBackend();
    await syncUsersToBackend();
    await syncProductsToBackend(forceAll);
    await syncPelangganToBackend(forceAll);
    await syncInventoryToBackend(forceAll);
    await syncInventoryEventsToBackend(forceAll);
  } finally {
    isMasterSyncing = false;
  }
};

/**
 * Sinkronisasi seluruh order yang belum ter-sync (isDirty: 1) atau forceAll untuk re-sync
 */
export const syncDirtyOrders = async (forceAll = false) => {
  if (isPublicRoute() || !getAuthToken()) return;
  // Cegah multiple sync bersamaan (Concurrency Lock)
  if (isSyncing) return;

  try {
    isSyncing = true;

    // Cek dulu apakah ada order yang kotor atau paksa semua jika forceAll
    const dirtyOrders = forceAll
      ? await db.orders.toArray()
      : await db.orders.filter(o => o.isDirty === 1).toArray();

    if (dirtyOrders.length === 0) {
      isSyncing = false;
      return;
    }


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
      headers: getAuthHeaders(),
      body: JSON.stringify(payloads),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.results) {
        for (const res of result.results) {
          if (res.status === 'success') {
            const ord = dirtyOrders.find(o => o.uuid === res.id);
            if (ord) {
              const updateData = { isDirty: 0 };
              if (res.data?.inventoryUsed) {
                updateData.inventoryUsed = res.data.inventoryUsed;
              }
              if (res.data?.id) {
                updateData.uuid = res.data.id;
              }
              if (res.data?.updatedAt) {
                updateData.updatedAt = new Date(res.data.updatedAt);
              }
              await db.orders.update(ord.id, updateData);
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`[Sync] Gagal batch sync (offline/server unreachable): ${error.message}`);
  } finally {
    isSyncing = false;
  }
};

let isPullingOrders = false;
let lastOrderPullTime = 0;
const ORDER_PULL_COOLDOWN_MS = 30000; // Cooldown 30 detik untuk mencegah spam request berulang
let lastProductsPullTime = 0;
let lastPelangganPullTime = 0;
let lastInvEventsPullTime = 0;

/**
 * Tarik seluruh daftar order dari backend PostgreSQL untuk toko yang aktif (Pull Sync)
 * @param {boolean} force - jika true, abaikan cooldown 15 detik (misal saat klik refresh manual)
 */
export const pullOrdersFromBackend = async (force = false) => {
  if (isPublicRoute() || !getAuthToken()) return false;
  const now = Date.now();

  // 1. Concurrency Lock: Jangan panggil jika sedang berjalan
  if (isPullingOrders) return false;

  // 2. Cooldown Guard: Skip jika baru saja ditarik kurang dari 15 detik lalu
  if (!force && (now - lastOrderPullTime < ORDER_PULL_COOLDOWN_MS)) {
    return false;
  }

  isPullingOrders = true;

  try {
    const storedUser = getStoredUser();
    const setting = await db.settings.get(1);
    let storeId = storedUser.storeId || setting?.storeId;
    if (!storeId && db && db.users && typeof db.users.toArray === 'function') {
      const allUsers = await db.users.toArray();
      if (Array.isArray(allUsers)) {
        const anyUser = allUsers.find(u => u.storeId);
        if (anyUser?.storeId) storeId = anyUser.storeId;
      }
    }
    if (!storeId) return false;

    const lastSyncIso = localStorage.getItem('kasir_last_orders_sync');
    let fetchUrl = `${API_BASE_URL}/orders?storeId=${encodeURIComponent(storeId)}&includeDeleted=true`;
    if (!force && lastSyncIso) {
      fetchUrl += `&since=${encodeURIComponent(lastSyncIso)}`;
    }

    const response = await fetch(fetchUrl, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('[Sync] Gagal pull orders: 401 Unauthorized');
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      return false;
    }

    lastOrderPullTime = Date.now();
    const currentSyncIso = new Date().toISOString();

    const result = await response.json();
    const serverOrders = result.data || [];
    if (!Array.isArray(serverOrders)) return false;

    // Fast-path: Jika tidak ada data baru/berubah sama sekali, selesaikan instan (0 ms I/O)
    if (serverOrders.length === 0 && (!result.inventory || result.inventory.length === 0) && (!result.products || result.products.length === 0)) {
      localStorage.setItem('kasir_last_orders_sync', currentSyncIso);
      return true;
    }

    for (const so of serverOrders) {
      // 1. Cari apakah order sudah ada di Dexie berdasarkan uuid atau invoiceId
      let localOrder = null;
      if (so.id) {
        localOrder = await db.orders.where('uuid').equals(so.id).first();
      }
      if (!localOrder && so.invoiceId) {
        localOrder = await db.orders.where('invoiceId').equals(so.invoiceId).first();
      }

      // 2. Format items
      const serverItems = (so.items || []).map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        subtotal: Number(item.subtotal) || 0,
      }));

      // 3. Siapkan payload
      const orderPayload = {
        uuid: so.id,
        storeId: so.storeId || storeId,
        invoiceId: so.invoiceId,
        userId: so.userId,
        pelangganId: so.pelangganId,
        pelangganNama: so.pelanggan?.nama || so.pelangganNama || localOrder?.pelangganNama || 'Pelanggan',
        total: Number(so.total) || 0,
        diskon: Number(so.diskon) || 0,
        bayar: Number(so.bayar) || 0,
        kembalian: Number(so.kembalian) || 0,
        metodeBayar: so.metodeBayar || 'Tunai',
        estimasi: so.estimasi !== null && so.estimasi !== undefined ? String(so.estimasi) : '0',
        tipeLayanan: so.tipeLayanan || 'Datang Langsung',
        isPriority: Boolean(so.isPriority),
        statusBayar: so.statusBayar || 'Lunas',
        status: so.status || 'Proses',
        catatan: so.catatan || null,
        catatanKasir: so.catatanKasir || localOrder?.catatanKasir || null,
        kasirUsername: so.user?.username || so.user?.fullname || localOrder?.kasirUsername || null,
        // Lindungi inventoryUsed: Jangan timpa dengan array kosong jika lokal sudah memiliki data
        inventoryUsed: (Array.isArray(so.inventoryUsed) && so.inventoryUsed.length > 0)
          ? so.inventoryUsed
          : (localOrder?.inventoryUsed || []),
        items: serverItems,
        createdAt: so.createdAt ? new Date(so.createdAt) : new Date(),
        updatedAt: so.updatedAt ? new Date(so.updatedAt) : new Date(),
        deletedAt: so.deletedAt ? new Date(so.deletedAt) : null,
        isDirty: 0,
      };

      // 4. Pastikan data pelanggan tersimpan di db.pelanggan lokal juga jika ada
      if (so.pelanggan && so.pelanggan.id) {
        let localPel = await db.pelanggan.where('uuid').equals(so.pelanggan.id).first();
        if (!localPel && so.pelanggan.hp && so.pelanggan.hp !== '-') {
          localPel = await db.pelanggan.where('hp').equals(so.pelanggan.hp).first();
        }

        // Jangan timpa jika pelanggan lokal memiliki perubahan yang belum di-sync (isDirty: 1) atau sudah dihapus
        if (!localPel || (localPel.isDirty !== 1 && !localPel.deletedAt)) {
          const pelPayload = {
            uuid: so.pelanggan.id,
            storeId: so.storeId || storeId,
            nama: so.pelanggan.nama,
            hp: so.pelanggan.hp || '-',
            alamat: so.pelanggan.alamat || '-',
            updatedAt: new Date(so.pelanggan.updatedAt || new Date()),
            deletedAt: so.pelanggan.deletedAt ? new Date(so.pelanggan.deletedAt) : null,
            isDirty: 0,
          };
          if (localPel) {
            await db.pelanggan.update(localPel.id, pelPayload);
          } else {
            await db.pelanggan.add(pelPayload);
          }
        }
      }

      // 5. Simpan ke db.orders
      if (localOrder) {
        // JANGAN TIMPA pesanan lokal yang berstatus kotor (isDirty === 1) yang sedang menunggu sinkronisasi
        if (localOrder.isDirty !== 1) {
          await db.orders.update(localOrder.id, orderPayload);
        }
      } else {
        await db.orders.add(orderPayload);
      }
    }

    // 5b. Rekonsiliasi penghapusan: HANYA dilakukan saat full sync (bukan incremental sync)
    if (force || !lastSyncIso) {
      try {
        const activeServerUuids = new Set(serverOrders.map(o => o.id).filter(Boolean));
        const activeServerInvoices = new Set(serverOrders.map(o => o.invoiceId).filter(Boolean));
        const localOrdersInStore = await db.orders.filter(o => (!o.storeId || o.storeId === storeId) && !o.deletedAt && o.isDirty !== 1).toArray();
        
        for (const lo of localOrdersInStore) {
          const isRecent = lo.createdAt && (Date.now() - new Date(lo.createdAt).getTime() < 30 * 60 * 1000);
          if (isRecent) continue;

          const existsInServer = (lo.uuid && activeServerUuids.has(lo.uuid)) || (lo.invoiceId && activeServerInvoices.has(lo.invoiceId));
          if (!existsInServer) {
            await db.orders.update(lo.id, { deletedAt: new Date(), isDirty: 0 });
          }
        }
      } catch (reconcileErr) {
        console.warn('[Sync] Rekonsiliasi order lokal error:', reconcileErr);
      }
    }

    localStorage.setItem('kasir_last_orders_sync', currentSyncIso);

    // 6. Tarik dan Sinkronkan Inventory dari Response GET /orders?storeId=...
    const serverInventory = result.inventory || [];
    if (Array.isArray(serverInventory) && serverInventory.length > 0) {
      for (const sinv of serverInventory) {
        let localInv = null;
        if (sinv.id) {
          localInv = await db.inventory.where('uuid').equals(sinv.id).first();
        }
        if (!localInv && sinv.nama) {
          localInv = await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === sinv.nama.toLowerCase()).first();
        }

        const invPayload = {
          uuid: sinv.id,
          storeId: sinv.storeId || storeId,
          nama: sinv.nama,
          stok: Number(sinv.stok) || 0,
          qty: Number(sinv.qty) || 0,
          unit: sinv.unit || null,
          status: sinv.status || 'approved',
          createdBy: sinv.createdBy || null,
          createdAt: sinv.createdAt ? new Date(sinv.createdAt) : new Date(),
          updatedAt: sinv.updatedAt ? new Date(sinv.updatedAt) : new Date(),
          deletedAt: sinv.deletedAt ? new Date(sinv.deletedAt) : null,
          isDirty: 0,
        };

        if (localInv) {
          // Jangan timpa jika item lokal masih memiliki perubahan lokal yang belum di-sync
          if (localInv.isDirty !== 1) {
            await db.inventory.update(localInv.id, invPayload);
          }
        } else {
          await db.inventory.add(invPayload);
        }
      }
    }

    // 7. Tarik dan Sinkronkan Products dari Response GET /orders?storeId=...
    const serverProducts = result.products || [];
    if (Array.isArray(serverProducts) && serverProducts.length > 0) {
      for (const sp of serverProducts) {
        let localProd = null;
        if (sp.id) {
          localProd = await db.products.where('uuid').equals(sp.id).first();
        }
        if (!localProd && sp.code) {
          try {
          try {
          localProd = await db.products.where('code').equals(sp.code).first();
        } catch (e) {
          localProd = await db.products.filter(p => p.code === sp.code).first();
        }
        } catch (e) {
          localProd = await db.products.filter(p => p.code === sp.code).first();
        }
        }
        if (!localProd && sp.category && sp.name) {
          localProd = await db.products.filter(p => p.category === sp.category && p.name === sp.name).first();
        }

        const prodPayload = {
          uuid: sp.id,
          storeId: sp.storeId || storeId,
          code: sp.code || null,
          category: sp.category || null,
          name: sp.name,
          price: Number(sp.price) || 0,
          createdAt: sp.createdAt ? new Date(sp.createdAt) : new Date(),
          updatedAt: sp.updatedAt ? new Date(sp.updatedAt) : new Date(),
          deletedAt: sp.deletedAt ? new Date(sp.deletedAt) : null,
          isDirty: 0,
        };

        if (localProd) {
          if (localProd.isDirty !== 1 || force) {
            await db.products.update(localProd.id, prodPayload);
          }
        } else {
          await db.products.add(prodPayload);
        }
      }
    }

    // 8. Sinkronkan lastInvoiceNumber pada setting agar nomor nota tidak bentrok setelah reset/ganti device
    let maxInvoiceNum = 0;
    for (const so of serverOrders) {
      if (so.invoiceId && so.invoiceId.includes('-')) {
        const parts = so.invoiceId.split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsed) && parsed > maxInvoiceNum) {
          maxInvoiceNum = parsed;
        }
      }
    }
    if (maxInvoiceNum > 0) {
      const currentSetting = await db.settings.get(1);
      if (currentSetting && (currentSetting.lastInvoiceNumber || 0) < maxInvoiceNum) {
        await db.settings.update(1, { lastInvoiceNumber: maxInvoiceNum });
      }
    }

    return true;
  } catch (err) {
    console.warn('[Sync] Gagal menarik order dari server (offline):', err.message);
    return false;
  } finally {
    isPullingOrders = false;
  }
};

/**
 * Tarik dan Sinkronkan Produk / Layanan terbaru dari Backend ke Dexie
 */
export const pullProductsFromBackend = async (force = false) => {
  if (isPublicRoute() || !getAuthToken()) return false;
  const now = Date.now();
  if (!force && (now - lastProductsPullTime < 60000)) return false;
  lastProductsPullTime = now;
  try {
    const storedUser = getStoredUser();
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;
    if (!storeId) return false;

    const response = await fetch(`${API_BASE_URL}/sync/products?storeId=${storeId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) return false;

    const result = await response.json();
    const serverProducts = result.data || result || [];

    if (Array.isArray(serverProducts) && serverProducts.length > 0) {
      for (const sp of serverProducts) {
        let localProd = null;
        if (sp.id) {
          localProd = await db.products.where('uuid').equals(sp.id).first();
        }
        if (!localProd && sp.code) {
          localProd = await db.products.where('code').equals(sp.code).first();
        }
        if (!localProd && sp.category && sp.name) {
          localProd = await db.products.filter(p => p.category === sp.category && p.name === sp.name).first();
        }

        const prodPayload = {
          uuid: sp.id,
          storeId: sp.storeId || storeId,
          code: sp.code || null,
          category: sp.category || null,
          name: sp.name,
          price: Number(sp.price) || 0,
          createdAt: sp.createdAt ? new Date(sp.createdAt) : new Date(),
          updatedAt: sp.updatedAt ? new Date(sp.updatedAt) : new Date(),
          deletedAt: sp.deletedAt ? new Date(sp.deletedAt) : null,
          isDirty: 0,
        };

        if (localProd) {
          if (localProd.isDirty !== 1 || force) {
            await db.products.update(localProd.id, prodPayload);
          }
        } else {
          await db.products.add(prodPayload);
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[Sync] Gagal menarik produk dari server (offline):', err.message);
    return false;
  }
};

/**
 * Tarik dan Sinkronkan Pelanggan terbaru dari Backend ke Dexie
 */
export const pullPelangganFromBackend = async (force = false) => {
  if (isPublicRoute() || !getAuthToken()) return false;
  const now = Date.now();
  if (!force && (now - lastPelangganPullTime < 60000)) return false;
  lastPelangganPullTime = now;
  try {
    const storedUser = getStoredUser();
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;
    if (!storeId) return false;

    const response = await fetch(`${API_BASE_URL}/sync/pelanggan?storeId=${storeId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) return false;

    const result = await response.json();
    const serverPelanggan = result.data || result || [];

    if (Array.isArray(serverPelanggan) && serverPelanggan.length > 0) {
      for (const sp of serverPelanggan) {
        let localPel = null;
        if (sp.id) {
          localPel = await db.pelanggan.where('uuid').equals(sp.id).first();
        }
        if (!localPel && sp.hp && sp.hp !== '-') {
          localPel = await db.pelanggan.where('hp').equals(sp.hp).first();
        }
        if (!localPel && sp.nama) {
          localPel = await db.pelanggan.filter(p => p.nama && p.nama.toLowerCase().trim() === sp.nama.toLowerCase().trim()).first();
        }

        const pelPayload = {
          uuid: sp.id,
          storeId: sp.storeId || storeId,
          nama: sp.nama,
          hp: sp.hp || '-',
          alamat: sp.alamat || '-',
          createdAt: sp.createdAt ? new Date(sp.createdAt) : new Date(),
          updatedAt: sp.updatedAt ? new Date(sp.updatedAt) : new Date(),
          deletedAt: sp.deletedAt ? new Date(sp.deletedAt) : null,
          isDirty: 0,
        };

        if (localPel) {
          // Jangan timpa jika pelanggan lokal berstatus dirty (isDirty: 1) sementara data server belum mencatat deletedAt
          if (localPel.isDirty === 1 && !sp.deletedAt) {
            continue;
          }
          if (localPel.isDirty !== 1 || force) {
            await db.pelanggan.update(localPel.id, pelPayload);
          }
        } else {
          await db.pelanggan.add(pelPayload);
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[Sync] Gagal menarik pelanggan dari server (offline):', err.message);
    return false;
  }
};


let isPullingInventoryEvents = false;
let lastInventoryEventsPullTime = 0;
const INVENTORY_EVENTS_PULL_COOLDOWN_MS = 15000;

/**
 * Tarik dan Sinkronkan riwayat mutasi InventoryEvents terbaru dari Backend ke Dexie
 */
export const pullInventoryEventsFromBackend = async (force = false) => {
  if (isPublicRoute() || !getAuthToken()) return false;
  const now = Date.now();

  // Cegah multiple pull bersamaan & cooldown 60 detik
  if (isPullingInventoryEvents) return false;
  if (!force && (now - lastInventoryEventsPullTime < 60000)) {
    return false;
  }

  isPullingInventoryEvents = true;

  try {
    const storedUser = getStoredUser();
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;
    if (!storeId) return false;

    lastInventoryEventsPullTime = Date.now();

    const response = await fetch(`${API_BASE_URL}/sync/inventory-events?storeId=${encodeURIComponent(storeId)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) return false;

    const result = await response.json();
    const serverEvents = result.data || result || [];

    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      for (const se of serverEvents) {
        let localEvt = null;
        if (se.id) {
          localEvt = await db.inventoryEvents.where('uuid').equals(se.id).first();
        }
        if (!localEvt && se.invoiceId && se.inventoryName) {
          localEvt = await db.inventoryEvents
            .filter(e => e.invoiceId === se.invoiceId && (e.inventoryName === se.inventoryName || e.inventoryId === se.inventoryId))
            .first();
        }

        const evtPayload = {
          uuid: se.id,
          storeId: se.storeId || storeId,
          inventoryId: se.inventoryId || undefined,
          inventoryName: se.inventoryName || 'Barang Laundry',
          type: se.type || 'ADD',
          qty: Number(se.qty) || 0,
          note: se.note || null,
          invoiceId: se.invoiceId || null,
          createdBy: se.createdBy || null,
          kasirPengaju: se.kasirPengaju || null,
          createdAt: se.createdAt ? new Date(se.createdAt) : new Date(),
          updatedAt: se.updatedAt ? new Date(se.updatedAt) : new Date(),
          deletedAt: se.deletedAt ? new Date(se.deletedAt) : null,
          isDirty: 0,
        };

        if (localEvt) {
          if (localEvt.isDirty !== 1 || force) {
            await db.inventoryEvents.update(localEvt.id, evtPayload);
          }
        } else {
          await db.inventoryEvents.add(evtPayload);
        }
      }
    }
    return true;
  } catch (err) {
    console.warn('[Sync] Gagal menarik inventory events dari server (offline):', err.message);
    return false;
  } finally {
    isPullingInventoryEvents = false;
  }
};

/**
 * Ambil langsung data pergerakan stok dari DB (PostgreSQL) via API /sync/inventory-events
 */
export const getInventoryEventsFromDB = async () => {
  try {
    const storedUser = getStoredUser();
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;
    if (!storeId) return null;

    const response = await fetch(`${API_BASE_URL}/sync/inventory-events?storeId=${encodeURIComponent(storeId)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) return null;

    const result = await response.json();
    const serverEvents = result.data || result || [];

    // Sinkronkan ke IndexedDB lokal juga agar data lokal selalu sinkron dengan DB
    if (Array.isArray(serverEvents) && serverEvents.length > 0) {
      for (const se of serverEvents) {
        let localEvt = null;
        if (se.id) {
          localEvt = await db.inventoryEvents.where('uuid').equals(se.id).first();
        }
        if (!localEvt && se.invoiceId && se.inventoryName) {
          localEvt = await db.inventoryEvents
            .filter(e => e.invoiceId === se.invoiceId && (e.inventoryName === se.inventoryName || e.inventoryId === se.inventoryId))
            .first();
        }

        const evtPayload = {
          uuid: se.id,
          storeId: se.storeId || storeId,
          inventoryId: se.inventoryId || undefined,
          inventoryName: se.inventoryName || 'Barang Laundry',
          type: se.type || 'ADD',
          qty: Number(se.qty) || 0,
          note: se.note || null,
          invoiceId: se.invoiceId || null,
          createdBy: se.createdBy || null,
          kasirPengaju: se.kasirPengaju || null,
          createdAt: se.createdAt ? new Date(se.createdAt) : new Date(),
          updatedAt: se.updatedAt ? new Date(se.updatedAt) : new Date(),
          deletedAt: se.deletedAt ? new Date(se.deletedAt) : null,
          isDirty: 0,
        };

        if (localEvt) {
          await db.inventoryEvents.update(localEvt.id, evtPayload);
        } else {
          await db.inventoryEvents.add(evtPayload);
        }
      }
    }

    return serverEvents;
  } catch (err) {
    console.warn('[Sync] Gagal get inventory events dari DB:', err.message);
    return null;
  }
};

/**
 * Sinkronisasi Penuh Dua Arah (Two-Way Sync):
 * 1. PUSH: Dorong perubahan master data & order lokal (termasuk dirty / forceAll) ke backend
 * 2. PULL: Tarik data order, inventory, produk, dan pelanggan terbaru dari backend ke Dexie
 */
export const syncTwoWay = async ({ forceAll = false } = {}) => {
  try {
    await syncAllDirtyMasterData(forceAll);
    await syncDirtyOrders(forceAll);
    const pullSuccess = await pullOrdersFromBackend(true);
    await pullProductsFromBackend(true);
    await pullPelangganFromBackend(true);
    await pullInventoryEventsFromBackend(true);
    await syncPlansFromBackend().catch(() => {});
    return { success: true, pullSuccess };
  } catch (error) {
    console.error('[Sync] syncTwoWay gagal:', error);
    throw error;
  }
};

// Inisialisasi auto-sync saat koneksi kembali online dan interval background
if (typeof window !== 'undefined') {
  const isAutoSyncEnabled = import.meta.env.VITE_ENABLE_AUTO_SYNC !== 'false';
  // Default: 10 menit (600.000 ms) agar aplikasi sangat ringan & bebas lag
  const syncInterval = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '600000', 10);

  const shouldRunAutoSync = () => {
    if (!navigator.onLine) return false;
    if (isPublicRoute()) return false;
    if (!getAuthToken()) return false;
    return true;
  };

  if (isAutoSyncEnabled) {
    // 1. Sync instan saat internet kembali menyala
    window.addEventListener('online', async () => {
      if (!shouldRunAutoSync()) return;
      await syncAllDirtyMasterData();
      await syncDirtyOrders();
      await pullOrdersFromBackend();
      await pullProductsFromBackend();
      await pullPelangganFromBackend();
      await pullInventoryEventsFromBackend();
      await syncPlansFromBackend().catch(() => {});
    });

    // 2. Cek sekali saat pertama kali aplikasi dibuka (Hanya sinkronkan jika user telah login & bukan halaman publik)
    setTimeout(async () => {
      if (!shouldRunAutoSync()) return;
      await syncAllDirtyMasterData(false);
      await syncDirtyOrders(false);
      await pullOrdersFromBackend();
      await pullProductsFromBackend();
      await pullPelangganFromBackend();
      await pullInventoryEventsFromBackend();
      await syncPlansFromBackend().catch(() => {});
    }, 2000);

    // 3. Periodic background sync (Hanya berjalan jika tab aktif, browser online, dan user login)
    if (syncInterval > 0) {
      setInterval(async () => {
        if (shouldRunAutoSync() && (!document.hidden || document.visibilityState === 'visible')) {
          await syncAllDirtyMasterData();
          await syncDirtyOrders();
          await pullOrdersFromBackend();
          await pullProductsFromBackend();
          await pullInventoryEventsFromBackend();
          await syncPlansFromBackend().catch(() => {});
        }
      }, syncInterval);
    }
  }
}




