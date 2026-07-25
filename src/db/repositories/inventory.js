import { db } from '../../db.js';

export const getInventoryQuery = () => db.inventory.toArray();

export const getInventoryById = async (id) => {
  return await db.inventory.get(parseInt(id));
};

export const updateInventory = async (id, data) => {
  return await db.inventory.update(parseInt(id), data);
};

export const updateInventoryStok = async (id, delta) => {
  const item = await db.inventory.get(id);
  if (item) {
    const newStok = Math.max(0, (item.stok || 0) + delta);
    return await db.inventory.update(id, { stok: newStok });
  }
  throw new Error('Item tidak ditemukan');
};

export const approveInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  return await db.inventory.update(item.id, {
    stok: (item.stok || 0) + (item.qty || 0),
    qty: 0,
    status: 'approved'
  });
};

export const rejectInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  return await db.inventory.update(item.id, {
    qty: 0,
    status: 'rejected'
  });
};

export const addInventoryManual = async (nama, stok) => {
  if (!nama) throw new Error('Nama barang wajib diisi');
  const qty = Number(stok) || 0;
  
  const existing = await db.inventory.toArray();
  const existingItem = existing.find(i => i.nama.toLowerCase() === nama.toLowerCase());
  
  if (existingItem) {
    return await db.inventory.update(existingItem.id, { 
      stok: (existingItem.stok || 0) + qty 
    });
  } else {
    return await db.inventory.add({ nama, stok: qty, status: 'approved' });
  }
};
