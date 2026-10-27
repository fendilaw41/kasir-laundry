import { db } from '../db.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Mengambil JWT Bearer Token dari storage browser (sessionStorage / localStorage / user)
 */
export const getAuthToken = () => {
  try {
    return (
      sessionStorage.getItem('token') ||
      localStorage.getItem('auth_token') ||
      JSON.parse(sessionStorage.getItem('user') || '{}')?.token ||
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
    pelanggan = await db.pelanggan.get(order.pelangganId);
  }

  // Dapatkan Store ID agar data terisolasi per toko (Multi-store isolation)
  const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
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
    estimasi: order.estimasi !== undefined && order.estimasi !== null ? String(order.estimasi) : null,
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
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      // Tandai data lokal sudah ter-sync
      await db.orders.update(order.id, { isDirty: 0 });
      console.log(`[Sync] Order ${order.invoiceId} berhasil disinkronkan ke BE.`);
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
      console.log(`[Sync] ${dirtyUsers.length} user berhasil disinkronkan ke BE.`);
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
      : await db.pelanggan.filter(p => p.isDirty === 1).toArray();

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
      console.log(`[Sync] Settings toko berhasil disinkronkan ke BE.`);
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
      console.log(`[Sync] ${dirtyInventory.length} item inventory berhasil disinkronkan ke BE.`);
    }
  } catch (err) {
    console.warn(`[Sync] Gagal sync inventory (offline): ${err.message}`);
  }
};

/**
 * Sinkronisasi seluruh master data (Users, Products, Pelanggan, Settings, Inventory)
 */
export const syncAllDirtyMasterData = async (forceAll = false) => {
  if (isMasterSyncing) return;

  try {
    isMasterSyncing = true;
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
    await syncInventoryToBackend(forceAll);
  } finally {
    isMasterSyncing = false;
  }
};

/**
 * Sinkronisasi seluruh order yang belum ter-sync (isDirty: 1) atau forceAll untuk re-sync
 */
export const syncDirtyOrders = async (forceAll = false) => {
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

    console.log(`[Sync] Menemukan ${dirtyOrders.length} order untuk disinkronkan...`);

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

let isPullingOrders = false;
let lastOrderPullTime = 0;
const ORDER_PULL_COOLDOWN_MS = 15000; // Cooldown 15 detik untuk mencegah spam request berulang

/**
 * Tarik seluruh daftar order dari backend PostgreSQL untuk toko yang aktif (Pull Sync)
 * @param {boolean} force - jika true, abaikan cooldown 15 detik (misal saat klik refresh manual)
 */
export const pullOrdersFromBackend = async (force = false) => {
  const now = Date.now();

  // 1. Concurrency Lock: Jangan panggil jika sedang berjalan
  if (isPullingOrders) return false;

  // 2. Cooldown Guard: Skip jika baru saja ditarik kurang dari 15 detik lalu
  if (!force && (now - lastOrderPullTime < ORDER_PULL_COOLDOWN_MS)) {
    return false;
  }

  isPullingOrders = true;

  try {
    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const setting = await db.settings.get(1);
    const storeId = storedUser.storeId || setting?.storeId;
    if (!storeId) return false;

    const response = await fetch(`${API_BASE_URL}/orders?storeId=${encodeURIComponent(storeId)}`, {
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

    const result = await response.json();
    const serverOrders = result.data || [];
    if (!Array.isArray(serverOrders)) return false;

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
        pelangganNama: so.pelanggan?.nama || so.pelangganNama || 'Pelanggan',
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
        inventoryUsed: so.inventoryUsed || [],
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
        const pelPayload = {
          uuid: so.pelanggan.id,
          storeId: so.storeId || storeId,
          nama: so.pelanggan.nama,
          hp: so.pelanggan.hp || '-',
          alamat: so.pelanggan.alamat || '-',
          updatedAt: new Date(so.pelanggan.updatedAt || new Date()),
          isDirty: 0,
        };
        if (localPel) {
          await db.pelanggan.update(localPel.id, pelPayload);
        } else {
          await db.pelanggan.add(pelPayload);
        }
      }

      // 5. Simpan ke db.orders
      if (localOrder) {
        // Jangan timpa jika data lokal memiliki perubahan yang belum di-sync
        if (localOrder.isDirty !== 1) {
          await db.orders.update(localOrder.id, orderPayload);
        }
      } else {
        await db.orders.add(orderPayload);
      }
    }

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
      console.log(`[Sync] Berhasil memperbarui ${serverInventory.length} inventory dari server.`);
    }

    console.log(`[Sync] Berhasil menarik ${serverOrders.length} order dari server.`);
    return true;
  } catch (err) {
    console.warn('[Sync] Gagal menarik order dari server (offline):', err.message);
    return false;
  } finally {
    isPullingOrders = false;
  }
};

// Inisialisasi auto-sync saat koneksi kembali online dan interval background
if (typeof window !== 'undefined') {
  const isAutoSyncEnabled = import.meta.env.VITE_ENABLE_AUTO_SYNC !== 'false';
  // Default: 10 menit (600.000 ms) agar aplikasi sangat ringan & bebas lag
  const syncInterval = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '600000', 10);

  if (isAutoSyncEnabled) {
    // 1. Sync instan saat internet kembali menyala
    window.addEventListener('online', async () => {
      console.log('[Sync] Jaringan online terdeteksi, memulai sinkronisasi...');
      await syncAllDirtyMasterData();
      await syncDirtyOrders();
      await pullOrdersFromBackend();
    });

    // 2. Cek sekali saat pertama kali aplikasi dibuka (Hanya sinkronkan data yang kotor/belum tersinkron lalu tarik order)
    if (navigator.onLine) {
      setTimeout(async () => {
        await syncAllDirtyMasterData(false);
        await syncDirtyOrders(false);
        await pullOrdersFromBackend();
      }, 2000);
    }

    // 3. Periodic background sync (Hanya berjalan jika tab aktif & browser online)
    if (syncInterval > 0) {
      setInterval(async () => {
        if (navigator.onLine && (!document.hidden || document.visibilityState === 'visible')) {
          await syncAllDirtyMasterData();
          await syncDirtyOrders();
          await pullOrdersFromBackend();
        }
      }, syncInterval);
    }
  }
}




