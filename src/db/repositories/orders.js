import { db } from '../../db.js';
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

  await db.transaction('rw', [db.orders, db.inventory, db.cart, db.settings], async () => {
    const setting = await db.settings.get(1);
    const namaLaundry = setting?.namaLaundry || 'INVOICE';
    const words = namaLaundry.trim().split(' ').filter(Boolean);
    const initials = words.length > 1 
        ? words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase()
        : words[0].substring(0, 2).toUpperCase();

    const nextNumber = (setting?.lastInvoiceNumber || 0) + 1;
    const invoiceId = `${initials}${nextNumber.toString().padStart(5, '0')}`;

    newId = await db.orders.add({
      ...orderData,
      invoiceId,
      bayar: bayar,
      kembalian: kembalianNum > 0 ? kembalianNum : 0,
      statusBayar: isLunas ? (bayar >= total ? 'Lunas' : 'DP') : 'Belum Bayar',
      status: 'Proses',
      createdAt: new Date()
    });

    // Kurangi stok untuk semua inventory yang dipilih
    if (orderData.inventoryUsed && orderData.inventoryUsed.length > 0) {
      for (const inv of orderData.inventoryUsed) {
        const item = await db.inventory.get(inv.id);
        const qty = Number(inv.quantity) || 1;
        if (item && item.stok >= qty) {
          await db.inventory.update(item.id, { stok: item.stok - qty });
        }
      }
    }

    await db.cart.clear();
    
    if (setting) {
      await db.settings.update(1, { lastInvoiceNumber: nextNumber });
    }
  });

  return newId;
};

export const updateOrder = async (id, data) => {
  if (!id) throw new Error('ID Order tidak valid');
  return await db.orders.update(parseInt(id), data);
};

export const deleteOrder = async (id) => {
  if (!id) throw new Error('ID Order tidak valid');
  return await db.orders.delete(parseInt(id));
};
