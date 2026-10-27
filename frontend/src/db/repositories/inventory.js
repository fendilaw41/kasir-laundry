import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncInventoryToBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';

export const getInventoryQuery = async () => {
  const storeId = await getActiveStoreId();
  const items = await db.inventory.toArray();
  const nonDeleted = items.filter(item => !item.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(item => !item.storeId || item.storeId === storeId);
};

export const getInventoryById = async (id) => {
  if (!id) return null;
  const storeId = await getActiveStoreId();
  const item = await db.inventory.get(parseInt(id, 10));
  if (!item || item.deletedAt) return null;
  if (storeId && item.storeId && item.storeId !== storeId) return null;
  return item;
};

export const updateInventory = async (id, data) => {
  const storeId = await getActiveStoreId();
  const updatePayload = { ...data };
  if (storeId && !updatePayload.storeId) {
    updatePayload.storeId = storeId;
  }
  const result = await db.inventory.update(parseInt(id, 10), withUpdatedSyncMeta(updatePayload));
  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return result;
};

export const updateInventoryStok = async (id, delta) => {
  const storeId = await getActiveStoreId();
  const item = await db.inventory.get(parseInt(id, 10));
  if (item) {
    const currentStok = Number(item.stok) || 0;
    const newStok = Math.max(0, currentStok + delta);
    const type = delta > 0 ? 'ADD' : 'SUBTRACT';
    const qty = Math.abs(delta);

    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      await db.inventory.update(item.id, withUpdatedSyncMeta({
        stok: newStok,
        ...(storeId && !item.storeId ? { storeId } : {})
      }));
      await db.inventoryEvents.add(withNewSyncMeta({
        storeId: storeId || item.storeId || undefined,
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
  const storeId = await getActiveStoreId();
  const currentStok = Number(item.stok) || 0;
  const pendingQty = Number(item.qty) || 0;
  const newStok = currentStok + pendingQty;

  await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
    await db.inventory.update(item.id, withUpdatedSyncMeta({
      stok: newStok,
      qty: 0,
      status: 'approved',
      ...(storeId && !item.storeId ? { storeId } : {})
    }));
    if (pendingQty > 0) {
      await db.inventoryEvents.add(withNewSyncMeta({
        storeId: storeId || item.storeId || undefined,
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
  const storeId = await getActiveStoreId();
  const result = await db.inventory.update(item.id, withUpdatedSyncMeta({
    qty: 0,
    status: 'approved', // Kembali ke approved agar item tidak hilang dari daftar Selesai
    ...(storeId && !item.storeId ? { storeId } : {})
  }));
  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return result;
};

export const addInventoryManual = async (nama, stok) => {
  if (!nama) throw new Error('Nama barang wajib diisi');
  const qty = Number(stok) || 0;
  const storeId = await getActiveStoreId();
  const cleanNama = nama.toLowerCase().trim();

  const existing = await db.inventory.toArray();
  const existingItem = existing.find(i =>
    !i.deletedAt &&
    (!storeId || !i.storeId || i.storeId === storeId) &&
    i.nama.toLowerCase().trim() === cleanNama
  );

  let targetId;
  if (existingItem) {
    const newStok = (Number(existingItem.stok) || 0) + qty;
    await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
      await db.inventory.update(existingItem.id, withUpdatedSyncMeta({
        stok: newStok,
        status: 'approved',
        ...(storeId && !existingItem.storeId ? { storeId } : {})
      }));
      if (qty > 0) {
        await db.inventoryEvents.add(withNewSyncMeta({
          storeId: storeId || existingItem.storeId || undefined,
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
        storeId: storeId || undefined,
        nama: nama.trim(),
        stok: qty,
        qty: 0,
        status: 'approved'
      }));
      if (qty > 0) {
        await db.inventoryEvents.add(withNewSyncMeta({
          storeId: storeId || undefined,
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
