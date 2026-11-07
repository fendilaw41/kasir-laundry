import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncInventoryToBackend, syncInventoryEventsToBackend, pullInventoryEventsFromBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';

export const getInventoryQuery = async () => {
  const storeId = await getActiveStoreId();
  const items = await db.inventory.toArray();
  const nonDeleted = items.filter(item => !item.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(item => !item.storeId || item.storeId === storeId);
};

export const getInventoryEventsQuery = async () => {
  const storeId = await getActiveStoreId();

  // Backfill riwayat mutasi keluar dari transaksi order yang memiliki inventoryUsed jika belum tercatat
  try {
    const ordersWithInv = await db.orders.filter(o => !o.deletedAt && Array.isArray(o.inventoryUsed) && o.inventoryUsed.length > 0).toArray();
    const existingEvents = await db.inventoryEvents.toArray();
    const existingKeys = new Set(existingEvents.filter(e => e.invoiceId).map(e => `${e.invoiceId}_${e.inventoryId || e.inventoryName}`));

    for (const ord of ordersWithInv) {
      for (const inv of ord.inventoryUsed) {
        const invKey = `${ord.invoiceId}_${inv.id || inv.nama}`;
        if (!existingKeys.has(invKey)) {
          existingKeys.add(invKey);
          await db.inventoryEvents.add(withNewSyncMeta({
            storeId: ord.storeId || storeId || undefined,
            inventoryId: inv.id || undefined,
            inventoryName: inv.nama || 'Item Laundry',
            type: 'SUBTRACT',
            qty: Number(inv.quantity ?? inv.qty ?? 1),
            note: `Transaksi order #${ord.invoiceId}`,
            invoiceId: ord.invoiceId,
            createdBy: ord.kasirUsername || 'Kasir',
            createdAt: ord.createdAt ? new Date(ord.createdAt) : new Date()
          }));
        }
      }
    }
  } catch (err) {
    console.warn('[InventoryEvents] Backfill error:', err);
  }

  const allEvents = await db.inventoryEvents.toArray();
  const nonDeleted = allEvents.filter(e => !e.deletedAt);
  const scoped = storeId ? nonDeleted.filter(e => !e.storeId || e.storeId === storeId) : nonDeleted;

  return scoped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

export const getInventoryById = async (id) => {
  if (!id) return null;
  const storeId = await getActiveStoreId();
  let item = null;
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    item = await db.inventory.get(numId);
  }
  if (!item && typeof id === 'string') {
    item = (await db.inventory.where('uuid').equals(id).first()) ||
           (await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === id.toLowerCase()).first());
  }
  if (!item || item.deletedAt) return null;
  if (storeId && item.storeId && item.storeId !== storeId) return null;
  return item;
};

export const updateInventory = async (id, data) => {
  if (!id) throw new Error('ID inventory tidak valid');
  let item = null;
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    item = await db.inventory.get(numId);
  }
  if (!item && typeof id === 'string') {
    item = (await db.inventory.where('uuid').equals(id).first()) ||
           (await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === id.toLowerCase()).first());
  }
  const targetId = item ? item.id : parseInt(id, 10);

  const storeId = await getActiveStoreId();
  const updatePayload = { ...data };
  if (storeId && !updatePayload.storeId) {
    updatePayload.storeId = storeId;
  }
  const result = await db.inventory.update(targetId, withUpdatedSyncMeta(updatePayload));
  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  return result;
};

export const updateInventoryStok = async (id, delta) => {
  const storeId = await getActiveStoreId();
  let item = null;
  const numId = parseInt(id, 10);
  if (!isNaN(numId)) {
    item = await db.inventory.get(numId);
  }
  if (!item && typeof id === 'string') {
    item = (await db.inventory.where('uuid').equals(id).first()) ||
           (await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === id.toLowerCase()).first());
  }
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
        inventoryName: item.nama,
        type,
        qty,
        note: delta > 0 ? 'Penyesuaian stok tambah manual' : 'Penyesuaian stok kurang manual',
        createdBy: 'Owner',
        createdAt: new Date()
      }));
    });

    syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
    syncInventoryEventsToBackend().catch(err => console.warn('[Sync] Sync inventory events error:', err));
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
      const storedUser = JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('user') || '{}') : '{}');
      const approver = storedUser?.username || storedUser?.fullname || 'Owner';
      await db.inventoryEvents.add(withNewSyncMeta({
        storeId: storeId || item.storeId || undefined,
        inventoryId: item.id,
        inventoryName: item.nama,
        type: 'ADD',
        qty: pendingQty,
        note: `Pengajuan di-ACC Owner (Diajukan oleh: ${item.createdBy || 'Kasir'})`,
        createdBy: approver,
        kasirPengaju: item.createdBy || 'Kasir',
        createdAt: new Date()
      }));
    }
  });

  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  syncInventoryEventsToBackend().catch(err => console.warn('[Sync] Sync inventory events error:', err));
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

export const addInventoryManual = async (nama, stok, options = {}) => {
  if (!nama) throw new Error('Nama barang wajib diisi');
  const qty = Number(stok) || 0;
  const storeId = await getActiveStoreId();
  const cleanNama = nama.toLowerCase().trim();
  const isPending = Boolean(options?.isPending);
  const storedUser = JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem('user') || '{}') : '{}');
  const createdBy = options?.user?.username || options?.user?.fullname || storedUser?.username || storedUser?.fullname || 'Kasir';

  const existing = await db.inventory.toArray();
  const existingItem = existing.find(i =>
    !i.deletedAt &&
    (!storeId || !i.storeId || i.storeId === storeId) &&
    i.nama.toLowerCase().trim() === cleanNama
  );

  let targetId;
  if (isPending) {
    if (existingItem) {
      await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
        await db.inventory.update(existingItem.id, withUpdatedSyncMeta({
          qty: (Number(existingItem.qty) || 0) + qty,
          status: 'pending',
          createdBy,
          ...(storeId && !existingItem.storeId ? { storeId } : {})
        }));
      });
      targetId = existingItem.id;
    } else {
      await db.transaction('rw', [db.inventory, db.inventoryEvents], async () => {
        targetId = await db.inventory.add(withNewSyncMeta({
          storeId: storeId || undefined,
          nama: nama.trim(),
          stok: 0,
          qty: qty,
          status: 'pending',
          createdBy,
          createdAt: new Date().toISOString()
        }));
      });
    }
  } else {
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
            inventoryName: existingItem.nama,
            type: 'ADD',
            qty: qty,
            note: 'Penambahan stok manual oleh Owner',
            createdBy: createdBy || 'Owner',
            createdAt: new Date()
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
          status: 'approved',
          createdBy
        }));
        if (qty > 0) {
          await db.inventoryEvents.add(withNewSyncMeta({
            storeId: storeId || undefined,
            inventoryId: targetId,
            inventoryName: nama.trim(),
            type: 'ADD',
            qty: qty,
            note: 'Stok awal barang baru oleh Owner',
            createdBy: createdBy || 'Owner',
            createdAt: new Date()
          }));
        }
      });
    }
  }

  syncInventoryToBackend().catch(err => console.warn('[Sync] Sync inventory error:', err));
  syncInventoryEventsToBackend().catch(err => console.warn('[Sync] Sync inventory events error:', err));
  return targetId;
};
