import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncInventoryToBackend } from '../../services/syncService.js';

export const getInventoryQuery = async () => {
  const items = await db.inventory.toArray();
  return items.filter(item => !item.deletedAt);
};

export const getInventoryById = async (id) => {
  const item = await db.inventory.get(parseInt(id));
  return item || null;
};

export const updateInventory = async (id, data) => {
  const result = await db.inventory.update(parseInt(id), withUpdatedSyncMeta(data));
  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return result;
};

export const updateInventoryStok = async (id, delta) => {
  const item = await db.inventory.get(parseInt(id));
  if (item) {
    const currentStok = Number(item.stok) || 0;
    const newStok = Math.max(0, currentStok + delta);
    const type = delta > 0 ? 'ADD' : 'SUBTRACT';
    const qty = Math.abs(delta);

    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      await db.inventory.update(item.id, withUpdatedSyncMeta({
        stok: newStok
      }));
      await db.inventoryEvents.add(withNewSyncMeta({
        inventoryId: item.id,
        type,
        qty,
        note: 'Manual stock adjustment',
        createdBy: 'system'
      }));
    });

    syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
    return item.id;
  }
  throw new Error('Item tidak ditemukan');
};

export const approveInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  const currentStok = Number(item.stok) || 0;
  const pendingQty = Number(item.qty) || 0;
  const newStok = currentStok + pendingQty;

  await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
    await db.inventory.update(item.id, withUpdatedSyncMeta({
      stok: newStok,
      qty: 0,
      status: 'approved'
    }));
    if (pendingQty > 0) {
      await db.inventoryEvents.add(withNewSyncMeta({
        inventoryId: item.id,
        type: 'ADD',
        qty: pendingQty,
        note: 'Approved inventory request',
        createdBy: 'system'
      }));
    }
  });

  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
};

export const rejectInventory = async (item) => {
  if (!item || !item.id) throw new Error('Item tidak valid');
  const result = await db.inventory.update(item.id, withUpdatedSyncMeta({
    qty: 0,
    status: 'approved' // Kembali ke approved agar item tidak hilang dari daftar Selesai
  }));
  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return result;
};

export const addInventoryManual = async (nama, stok) => {
  if (!nama) throw new Error('Nama barang wajib diisi');
  const qty = Number(stok) || 0;

  const existing = await db.inventory.toArray();
  const existingItem = existing.find(i => i.nama.toLowerCase() === nama.toLowerCase().trim());

  let targetId;
  if (existingItem) {
    const newStok = (Number(existingItem.stok) || 0) + qty;
    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      await db.inventory.update(existingItem.id, withUpdatedSyncMeta({
        stok: newStok,
        status: 'approved'
      }));
      if (qty > 0) {
        await db.inventoryEvents.add(withNewSyncMeta({
          inventoryId: existingItem.id,
          type: 'ADD',
          qty: qty,
          note: 'Manual addition',
          createdBy: 'system'
        }));
      }
    });
    targetId = existingItem.id;
  } else {
    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      targetId = await db.inventory.add(withNewSyncMeta({
        nama: nama.trim(),
        stok: qty,
        qty: 0,
        status: 'approved'
      }));
      if (qty > 0) {
        await db.inventoryEvents.add(withNewSyncMeta({
          inventoryId: targetId,
          type: 'ADD',
          qty: qty,
          note: 'Initial manual addition',
          createdBy: 'system'
        }));
      }
    });
  }

  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return targetId;
};

