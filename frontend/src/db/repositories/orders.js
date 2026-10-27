import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncOrderToBackend, syncInventoryToBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';

export const getOrdersQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.orders.toArray();
  const nonDeleted = all.filter(o => !o.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(o => !o.storeId || o.storeId === storeId);
};

export const getOrderByIdQuery = async (id) => {
  if (!id) return null;
  const storeId = await getActiveStoreId();
  let order = null;
  if (typeof id === 'string' && id.includes('-')) {
    order = await db.orders.where('uuid').equals(id).first();
  }
  if (!order) {
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      order = await db.orders.get(numId);
    }
  }
  if (!order || order.deletedAt) return null;
  if (storeId && order.storeId && order.storeId !== storeId) return null;
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
    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    const storeId = orderData.storeId || storedUser.storeId || setting?.storeId || undefined;
    const deviceId = setting?.deviceId || crypto.randomUUID().substring(0, 4).toUpperCase();
    const nextNumber = (setting?.lastInvoiceNumber || 0) + 1;
    const invoiceId = `${deviceId}-${nextNumber.toString().padStart(5, '0')}`;

    newId = await db.orders.add(withNewSyncMeta({
      storeId,
      ...orderData,
      invoiceId,
      bayar: bayar,
      kembalian: kembalianNum > 0 ? kembalianNum : 0,
      statusBayar: isLunas ? (bayar >= total ? 'Lunas' : 'DP') : 'Belum Bayar',
      status: 'Proses',
      createdAt: new Date()
    }));

    // Kurangi stok untuk semua inventory yang dipilih melalui event log dan update stok di db.inventory
    if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
      for (const inv of orderData.inventoryUsed) {
        let item = null;
        if (inv.id) {
          item = await db.inventory.get(parseInt(inv.id));
        }
        if (!item && inv.uuid) {
          item = await db.inventory.where('uuid').equals(inv.uuid).first();
        }
        if (!item && inv.nama) {
          item = await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === inv.nama.toLowerCase()).first();
        }

        const qty = Number(inv.quantity) || 1;
        if (item) {
          const currentStok = Number(item.stok) || 0;
          const newStok = Math.max(0, currentStok - qty);
          await db.inventory.update(item.id, withUpdatedSyncMeta({
            stok: newStok
          }));
          await db.inventoryEvents.add(withNewSyncMeta({
            inventoryId: item.id,
            type: 'SUBTRACT',
            qty: qty,
            note: `Checkout order ${invoiceId}`,
            createdBy: orderData.userId || 'system'
          }));
        }
      }
    }

    await db.cart.clear();

    if (setting) {
      await db.settings.update(1, withUpdatedSyncMeta({ lastInvoiceNumber: nextNumber }));
    }
  });

  // Trigger sync ke backend secara asynchronous
  if (newId) {
    syncOrderToBackend(newId).catch(err => console.warn('Sync order failed:', err));
    if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
      syncInventoryToBackend().catch(err => console.warn('Sync inventory after checkout failed:', err));
    }
  }

  return newId;
};

export const updateOrder = async (id, data) => {
  if (!id) throw new Error('ID Order tidak valid');

  if (data.status === 'Ambil' || data.status === 'Selesai') {
    const order = await db.orders.get(parseInt(id));
    if (!order) throw new Error('Order tidak ditemukan');

    if (data.status === 'Ambil') {
      // Check payment status from database, or from the incoming data if it's being updated simultaneously
      const currentStatusBayar = data.statusBayar || order.statusBayar;
      if (currentStatusBayar !== 'Lunas') {
        throw new Error('Pesanan belum lunas! Tidak bisa diambil.');
      }
    }

    const inventory = data.inventoryUsed || order.inventoryUsed || [];
    const hasDeterjen = inventory.some(item =>
      item.nama && item.nama.toLowerCase().includes('deterjen') && item.quantity >= 1
    );

    if (!hasDeterjen) {
      throw new Error(`Inventory terpakai minimal harus ada Deterjen 1x untuk dipindah ke status ${data.status}.`);
    }
  }

  const result = await db.orders.update(parseInt(id), withUpdatedSyncMeta(data));
  
  // Trigger sync ke backend secara asynchronous
  syncOrderToBackend(id).catch(err => console.warn('Sync update order failed:', err));

  return result;
};

export const deleteOrder = async (id) => {
  if (!id) throw new Error('ID Order tidak valid');
  // Soft delete supaya penghapusan order ikut ter-sync (tombstone), bukan hard delete.
  const result = await db.orders.update(parseInt(id), withUpdatedSyncMeta({ deletedAt: new Date() }));
  
  // Trigger sync ke backend secara asynchronous
  syncOrderToBackend(id).catch(err => console.warn('Sync delete order failed:', err));

  return result;
};
