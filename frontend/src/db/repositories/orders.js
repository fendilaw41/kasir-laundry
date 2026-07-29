import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
export const getOrdersQuery = () => db.orders.toArray();
export const getOrderByIdQuery = (id) => db.orders.get(parseInt(id));
export const getOrdersSortedByDateQuery = () => db.orders.orderBy('createdAt').reverse().toArray();

export const createOrderFromCheckout = async ({ orderData, bayarNum, kembalian, isLunas }) => {
  if (!orderData || typeof orderData.total === 'undefined') {
    throw new Error('Data order tidak valid');
  }

  const total = Math.max(0, parseInt(Number(orderData.total)) || 0);
  const bayar = Math.max(0, parseInt(Number(bayarNum)) || 0);
  const kembalianNum = Math.max(0, parseInt(Number(kembalian)) || 0);

  if (total <= 0 && (!orderData.cartItems || orderData.cartItems.length === 0)) {
    throw new Error('Total order tidak valid');
  }

  let newId;

  await db.transaction('rw', [db.orders, db.inventory, db.inventoryEvents, db.cart, db.settings], async () => {
    const setting = await db.settings.get(1);
    const deviceId = setting?.deviceId || crypto.randomUUID().substring(0, 4).toUpperCase();
    const nextNumber = (setting?.lastInvoiceNumber || 0) + 1;
    const invoiceId = `${deviceId}-${nextNumber.toString().padStart(5, '0')}`;

    newId = await db.orders.add(withNewSyncMeta({
      ...orderData,
      invoiceId,
      bayar: bayar,
      kembalian: kembalianNum > 0 ? kembalianNum : 0,
      statusBayar: isLunas ? (bayar >= total ? 'Lunas' : 'DP') : 'Belum Bayar',
      status: 'Proses',
      createdAt: new Date()
    }));

    // Kurangi stok untuk semua inventory yang dipilih melalui event log
    if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
      for (const inv of orderData.inventoryUsed) {
        const item = await db.inventory.get(inv.id);
        const qty = Number(inv.quantity) || 1;
        if (item) {
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

  return await db.orders.update(parseInt(id), withUpdatedSyncMeta(data));
};

export const deleteOrder = async (id) => {
  if (!id) throw new Error('ID Order tidak valid');
  // Soft delete supaya penghapusan order ikut ter-sync (tombstone), bukan hard delete.
  return await db.orders.update(parseInt(id), withUpdatedSyncMeta({ deletedAt: new Date() }));
};
