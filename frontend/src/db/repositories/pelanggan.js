import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncPelangganToBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';

export const getPelangganQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.pelanggan.toArray();
  const nonDeleted = all.filter(p => !p.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(p => p.storeId === storeId);
};

export const getPelangganByIdQuery = async (id, fallbackNama = null) => {
  if (!id && !fallbackNama) return null;
  const storeId = await getActiveStoreId();

  const matchesStore = (item) => {
    if (!item || item.deletedAt) return false;
    if (!storeId) return true;
    return item.storeId === storeId;
  };

  // 1. Jika ID berupa number murni (Dexie integer primary key)
  if (typeof id === 'number') {
    const item = await db.pelanggan.get(id);
    if (matchesStore(item)) return item;
  }

  // 2. Jika ID berupa string angka murni (misal "12", bukan UUID "5f7d8347-...")
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    const item = await db.pelanggan.get(parseInt(id, 10));
    if (matchesStore(item)) return item;
  }

  // 3. Jika ID berupa UUID string (dari backend PostgreSQL / sync)
  if (typeof id === 'string' && id.includes('-')) {
    const item = await db.pelanggan.where('uuid').equals(id).first();
    if (matchesStore(item)) return item;
  }

  // 4. Fallback: Cari berdasarkan nama jika ada
  if (fallbackNama) {
    const cleanFallback = fallbackNama.toLowerCase().trim();
    const item = await db.pelanggan.filter(p =>
      matchesStore(p) && p.nama && p.nama.toLowerCase().trim() === cleanFallback
    ).first();
    if (item) return item;
  }

  return null;
};

export const addPelanggan = async (pelangganData) => {
  const { nama, hp, alamat } = pelangganData;
  if (!nama || !hp) throw new Error('Nama dan No. HP wajib diisi');
  const storeId = await getActiveStoreId();

  const all = await db.pelanggan.toArray();
  const cleanNama = nama.toLowerCase().trim();
  const cleanHp = hp.trim();

  const existing = all.find(p =>
    !p.deletedAt &&
    (!storeId || !p.storeId || p.storeId === storeId) &&
    ((p.nama && p.nama.toLowerCase().trim() === cleanNama) || (p.hp && p.hp.trim() === cleanHp))
  );

  if (existing) {
    throw new Error('Gagal! Nama atau No. HP sudah terdaftar.');
  }

  const newId = await db.pelanggan.add(withNewSyncMeta({
    storeId: storeId || undefined,
    nama: nama.trim(),
    hp: cleanHp,
    alamat: alamat ? alamat.trim() : ''
  }));
  syncPelangganToBackend().catch(err => console.warn('[Sync] Sync pelanggan baru error:', err));
  return newId;
};

export const updatePelanggan = async (id, pelangganData) => {
  if (!id) throw new Error('ID Pelanggan tidak valid');
  let targetId = id;
  if (typeof id === 'string' && id.includes('-')) {
    const item = await db.pelanggan.where('uuid').equals(id).first();
    if (item) targetId = item.id;
  } else if (typeof id === 'string' && /^\d+$/.test(id)) {
    targetId = parseInt(id, 10);
  }

  const storeId = await getActiveStoreId();
  const updatePayload = { ...pelangganData };
  if (storeId && !updatePayload.storeId) {
    updatePayload.storeId = storeId;
  }

  const result = await db.pelanggan.update(targetId, withUpdatedSyncMeta(updatePayload));
  syncPelangganToBackend().catch(err => console.warn('[Sync] Sync update pelanggan error:', err));
  return result;
};

export const deletePelanggan = async (idOrPelanggan) => {
  if (!idOrPelanggan) throw new Error('ID Pelanggan tidak valid');
  let targetId = null;
  let pelanggan = null;

  const id = (typeof idOrPelanggan === 'object' && idOrPelanggan !== null)
    ? (idOrPelanggan.id || idOrPelanggan.uuid)
    : idOrPelanggan;

  if (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id))) {
    const numId = parseInt(id, 10);
    pelanggan = await db.pelanggan.get(numId);
    if (pelanggan) targetId = pelanggan.id;
  }
  if (!pelanggan && typeof id === 'string') {
    pelanggan = await db.pelanggan.where('uuid').equals(id).first();
    if (pelanggan) targetId = pelanggan.id;
  }
  if (!pelanggan) throw new Error('Pelanggan tidak ditemukan');

  const activeStoreId = await getActiveStoreId();

  // Cek apakah pelanggan masih memiliki order aktif (belum dihapus dan status bukan 'Dibatalkan')
  const allOrders = await db.orders.toArray();
  const activeOrders = allOrders.filter(o => {
    // Abaikan jika order sudah di-soft delete
    if (o.deletedAt) return false;

    // Filter store jika toko berbeda
    if (activeStoreId && o.storeId && o.storeId !== activeStoreId) return false;
    if (pelanggan.storeId && o.storeId && o.storeId !== pelanggan.storeId) return false;

    // Abaikan jika status order adalah Dibatalkan / Batal (request delete)
    const status = String(o.status || '').trim().toLowerCase();
    if (status === 'dibatalkan' || status === 'batal' || status === 'cancelled') return false;

    // Cocokkan id pelanggan
    const matchesId = Boolean(
      o.pelangganId && (
        o.pelangganId === pelanggan.id ||
        o.pelangganId === pelanggan.uuid ||
        String(o.pelangganId) === String(pelanggan.id) ||
        (pelanggan.uuid && String(o.pelangganId) === String(pelanggan.uuid))
      )
    );

    // Fallback cocokkan nama HANYA jika order belum punya pelangganId sama sekali
    const matchesNama = Boolean(
      !o.pelangganId &&
      o.pelangganNama &&
      pelanggan.nama &&
      o.pelangganNama.toLowerCase().trim() === pelanggan.nama.toLowerCase().trim()
    );

    return matchesId || matchesNama;
  });

  if (activeOrders.length > 0) {
    throw new Error('Pelanggan masih memiliki order aktif. Batalkan order terlebih dahulu.');
  }

  // Set soft-delete dan pastikan isDirty: 1 tersimpan di Dexie
  const result = await db.pelanggan.update(targetId, {
    deletedAt: new Date(),
    updatedAt: new Date(),
    isDirty: 1
  });

  // Segera sinkronkan penghapusan ke Backend
  syncPelangganToBackend().catch(err => console.warn('[Sync] Sync delete pelanggan error:', err));
  return result;
};
