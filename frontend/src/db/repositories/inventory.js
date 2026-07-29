import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';

const computeStock = async (item) => {
  if (!item) return null;
  const events = await db.inventoryEvents.where({ inventoryId: item.id }).toArray();
  const added = events.filter(e => e.type === 'ADD').reduce((sum, e) => sum + (e.qty || 0), 0);
  const subtracted = events.filter(e => e.type === 'SUBTRACT').reduce((sum, e) => sum + (e.qty || 0), 0);
  return { ...item, stok: Math.max(0, (item.stok || 0) + added - subtracted) };
};

export const getInventoryQuery = async () => {
  const items = await db.inventory.toArray();
  const events = await db.inventoryEvents.toArray();
  return items.map(item => {
    const itemEvents = events.filter(e => e.inventoryId === item.id);
    const added = itemEvents.filter(e => e.type === 'ADD').reduce((sum, e) => sum + (e.qty || 0), 0);
    const subtracted = itemEvents.filter(e => e.type === 'SUBTRACT').reduce((sum, e) => sum + (e.qty || 0), 0);
    return { ...item, stok: Math.max(0, (item.stok || 0) + added - subtracted) };
  });
};

export const getInventoryById = async (id) => {
  const item = await db.inventory.get(parseInt(id));
  return await computeStock(item);
};

export const updateInventory = async (id, data) => {
  return await db.inventory.update(parseInt(id), withUpdatedSyncMeta(data));
};

export const updateInventoryStok = async (id, delta) => {
  const item = await db.inventory.get(id);
  if (item) {
    const type = delta > 0 ? 'ADD' : 'SUBTRACT';
    const qty = Math.abs(delta);
    await db.inventoryEvents.add(withNewSyncMeta({
      inventoryId: item.id,
      type,
      qty,
      note: 'Manual stock adjustment',
      createdBy: 'system'
    }));
    return item.id;
  }
  throw new Error('Item tidak ditemukan');
};

export const approveInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
    await db.inventory.update(item.id, withUpdatedSyncMeta({
      qty: 0,
      status: 'approved'
    }));
    if (item.qty > 0) {
      await db.inventoryEvents.add(withNewSyncMeta({
        inventoryId: item.id,
        type: 'ADD',
        qty: item.qty,
        note: 'Approved inventory request',
        createdBy: 'system'
      }));
    }
  });
};

export const rejectInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  return await db.inventory.update(item.id, withUpdatedSyncMeta({
    qty: 0,
    status: 'approved' // Kembali ke approved agar item tidak hilang dari daftar Selesai
  }));
};

export const addInventoryManual = async (nama, stok) => {
  if (!nama) throw new Error('Nama barang wajib diisi');
  const qty = Number(stok) || 0;

  const existing = await db.inventory.toArray();
  const existingItem = existing.find(i => i.nama.toLowerCase() === nama.toLowerCase());

  if (existingItem) {
    if (qty > 0) {
      await db.inventoryEvents.add(withNewSyncMeta({
        inventoryId: existingItem.id,
        type: 'ADD',
        qty: qty,
        note: 'Manual addition',
        createdBy: 'system'
      }));
    }
    return existingItem.id;
  } else {
    let newId;
    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      newId = await db.inventory.add(withNewSyncMeta({ nama, stok: 0, status: 'approved' }));
      if (qty > 0) {
        await db.inventoryEvents.add(withNewSyncMeta({
          inventoryId: newId,
          type: 'ADD',
          qty: qty,
          note: 'Initial manual addition',
          createdBy: 'system'
        }));
      }
    });
    return newId;
  }
};
