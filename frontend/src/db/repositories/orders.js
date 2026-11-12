import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncOrderToBackend, syncOrderStatusToBackend, syncInventoryToBackend, syncInventoryEventsToBackend } from '../../services/syncService.js';
import { getActiveStoreId, getActiveStoreIdSync } from './storeHelper.js';
import { getStatusLunasByMetode, isStatusLunas } from '../../utils/paymentStatus.js';

export const getOrdersQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.orders.toArray();
  const nonDeleted = all.filter(o => !o.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(o => !o.storeId || o.storeId === storeId);
};

export const getOrderByIdQuery = async (id) => {
  if (!id) return null;
  let order = null;

  const numId = parseInt(id, 10);
  if (!isNaN(numId) && String(numId) === String(id)) {
    order = await db.orders.get(numId);
  }

  if (!order && typeof id === 'string') {
    order = await db.orders.where('uuid').equals(id).first();
  }

  if (!order && typeof id === 'string') {
    order = await db.orders.where('invoiceId').equals(id).first();
  }

  if (!order && !isNaN(numId)) {
    order = await db.orders.get(numId);
  }

  if (!order) return null;

  return order;
};

export const getOrdersSortedByDateQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.orders.orderBy('createdAt').reverse().toArray();
  const nonDeleted = all.filter(o => !o.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(o => !o.storeId || o.storeId === storeId);
};

export const createOrderFromCheckout = async ({ orderData, bayarNum, kembalian, isLunas }) => {
  if (!orderData || typeof orderData.total === 'undefined') {
    throw new Error('Data order tidak valid');
  }

  const total = Math.max(0, parseInt(Number(orderData.total)) || 0);
  const bayar = Math.max(0, parseInt(Number(bayarNum)) || 0);
  const kembalianNum = Math.max(0, parseInt(Number(kembalian)) || 0);

  const orderItems = orderData.items || orderData.cartItems || [];
  if (total <= 0 && orderItems.length === 0) {
    throw new Error('Total order tidak valid');
  }

  let newId;

  await db.transaction('rw', [db.orders, db.inventory, db.inventoryEvents, db.cart, db.settings], async () => {
    const setting = await db.settings.get(1);
    if (setting?.isTokoTutup) {
      throw new Error('Toko sedang tutup. Transaksi kasir diblokir.');
    }
    const storedUser = JSON.parse(
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
      (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null) ||
      '{}'
    );
    const activeStoreId = await getActiveStoreId();
    const storeId = orderData.storeId || storedUser.storeId || setting?.storeId || activeStoreId || undefined;
    const deviceId = setting?.deviceId || crypto.randomUUID().substring(0, 4).toUpperCase();
    const nextNumber = (setting?.lastInvoiceNumber || 0) + 1;
    const invoiceId = `${deviceId}-${nextNumber.toString().padStart(5, '0')}`;

    // 1. Validasi awal inventori terpakai (Pre-flight validation)
    const itemsToDeduct = [];
    if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
      for (const inv of orderData.inventoryUsed) {
        let item = null;
        if (typeof inv.id === 'number') {
          item = await db.inventory.get(inv.id);
        } else if (typeof inv.id === 'string' && /^\d+$/.test(inv.id.trim())) {
          item = await db.inventory.get(parseInt(inv.id.trim(), 10));
        }
        if (!item && inv.uuid) {
          item = await db.inventory.where('uuid').equals(inv.uuid).first();
        }
        if (!item && typeof inv.id === 'string' && inv.id.trim()) {
          item = await db.inventory.where('uuid').equals(inv.id.trim()).first();
        }
        if (!item && (inv.nama || inv.name)) {
          const searchName = (inv.nama || inv.name).trim().toLowerCase();
          item = await db.inventory.filter(i => i.nama && i.nama.trim().toLowerCase() === searchName).first();
        }

        if (!item) {
          throw new Error(`Barang inventori "${inv.nama || inv.name || inv.id}" tidak ditemukan di database. Transaksi dibatalkan.`);
        }

        const qty = Number(inv.quantity ?? inv.qty ?? 1);
        if (qty <= 0) {
          throw new Error(`Jumlah inventori "${item.nama}" harus lebih dari 0. Transaksi dibatalkan.`);
        }

        const currentStok = Number(item.stok) || 0;
        if (currentStok <= 0) {
          throw new Error(`Stok "${item.nama}" habis (0)! Transaksi dibatalkan.`);
        }
        if (currentStok < qty) {
          throw new Error(`Stok "${item.nama}" tidak mencukupi (sisa: ${currentStok}, dibutuhkan: ${qty}). Transaksi dibatalkan.`);
        }

        itemsToDeduct.push({ item, qty, currentStok });
      }
    }

    const orderDate = new Date();
    const resolvedStatusLunas = getStatusLunasByMetode(orderData.metodeBayar);
    newId = await db.orders.add(withNewSyncMeta({
      storeId,
      ...orderData,
      invoiceId,
      userId: orderData.userId || storedUser?.uuid || storedUser?.id || undefined,
      kasirUsername: orderData.kasirUsername || storedUser?.username || storedUser?.fullname || undefined,
      catatan: orderData.catatan || '',
      catatanKasir: orderData.catatanKasir || '',
      bayar: bayar,
      kembalian: kembalianNum > 0 ? kembalianNum : 0,
      statusBayar: isLunas
        ? (bayar >= total ? resolvedStatusLunas : 'DP')
        : (bayar > 0 ? (bayar >= total ? resolvedStatusLunas : 'DP') : 'Belum Bayar'),
      status: 'Proses',
      createdAt: orderDate
    }));

    // 2. Kurangi stok dan simpan event log mutasi stok
    for (const { item, qty, currentStok } of itemsToDeduct) {
      const newStok = Math.max(0, currentStok - qty);
      await db.inventory.update(item.id, withUpdatedSyncMeta({
        stok: newStok
      }));
      await db.inventoryEvents.add(withNewSyncMeta({
        storeId: storeId || item.storeId || undefined,
        inventoryId: item.id,
        inventoryName: item.nama,
        type: 'SUBTRACT',
        qty: qty,
        note: `Transaksi order #${invoiceId}`,
        invoiceId: invoiceId,
        createdBy: orderData.kasirUsername || storedUser?.username || storedUser?.fullname || 'Kasir',
        createdAt: orderDate
      }));
    }

    await db.cart.clear();

    if (setting) {
      await db.settings.update(1, withUpdatedSyncMeta({ lastInvoiceNumber: nextNumber }));
    }

    // Tambah notifikasi transaksi baru
    if (db.notifications) {
      await db.notifications.add(withNewSyncMeta({
        storeId,
        title: 'Transaksi Baru 🧺',
        message: `Pesanan #${invoiceId} senilai Rp${total.toLocaleString('id-ID')} berhasil dibuat.`,
        type: 'TRANSACTION',
        link: `/order/${newId}`,
        role: null,
        isRead: false,
        createdAt: orderDate.toISOString(),
      })).catch(() => {});
    }
  });

  // Trigger sync ke backend secara teratur (sekuensial) agar tidak membanjiri koneksi dan menghindari lock contention
  if (newId) {
    (async () => {
      try {
        await syncOrderToBackend(newId);
        if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
          await syncInventoryToBackend();
          await syncInventoryEventsToBackend();
        }
      } catch (err) {
        console.warn('[Orders] Background sync after checkout failed:', err);
      }
    })();
  }

  return newId;
};

export const updateOrder = async (id, data) => {
  if (!id) throw new Error('ID Order tidak valid');

  let order = null;
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    order = await db.orders.get(numId);
  }
  if (!order && typeof id === 'string') {
    order = (await db.orders.where('uuid').equals(id).first()) ||
            (await db.orders.where('invoiceId').equals(id).first());
  }
  if (!order) throw new Error('Order tidak ditemukan');

  const targetId = order.id;

  if (data.status === 'Ambil' || data.status === 'Selesai' || data.status === 'Proses') {
    if (data.status === 'Ambil') {
      const currentStatusBayar = data.statusBayar || order.statusBayar;
      if (!isStatusLunas(currentStatusBayar)) {
        throw new Error('Pesanan belum lunas! Tidak bisa diambil.');
      }
    }

    const inventory = data.inventoryUsed || order.inventoryUsed || [];
    const hasDeterjen = inventory.some(item =>
      item.nama && item.nama.toLowerCase().includes('deterjen') && Number(item.quantity ?? item.qty ?? 0) >= 1
    );

    if (!hasDeterjen) {
      throw new Error(`Inventory terpakai minimal harus ada Deterjen 1x untuk dipindah ke status ${data.status}.`);
    }
  }

  const result = await db.orders.update(targetId, withUpdatedSyncMeta(data));
  
  // Trigger sync ke backend secara non-blocking di background (0 ms response bagi kasir)
  const isStatusOnly = Object.keys(data).length === 1 && Boolean(data.status);
  const isNotesOnly = Object.keys(data).length > 0 && Object.keys(data).every(k => k === 'catatan' || k === 'catatanKasir');
  if (isStatusOnly) {
    syncOrderStatusToBackend(targetId, data.status).catch(err => console.warn('Sync status order failed:', err));
  } else if (isNotesOnly) {
    syncOrderStatusToBackend(targetId, order.status, data).catch(err => console.warn('Sync notes order failed:', err));
  } else {
    syncOrderToBackend(targetId).catch(err => console.warn('Sync update order failed:', err));
  }

  return result;
};

export const deleteOrder = async (id) => {
  if (!id) throw new Error('ID Order tidak valid');
  let order = null;
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    order = await db.orders.get(numId);
  }
  if (!order && typeof id === 'string') {
    order = (await db.orders.where('uuid').equals(id).first()) ||
            (await db.orders.where('invoiceId').equals(id).first());
  }
  const targetId = order ? order.id : parseInt(id, 10);
  // Soft delete supaya penghapusan order ikut ter-sync (tombstone), bukan hard delete.
  const result = await db.orders.update(targetId, withUpdatedSyncMeta({ deletedAt: new Date() }));
  
  // Trigger sync ke backend secara non-blocking di background (0 ms response bagi kasir)
  syncOrderToBackend(targetId).catch(err => console.warn('Sync delete order failed:', err));

  return result;
};
