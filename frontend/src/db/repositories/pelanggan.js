import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncPelangganToBackend } from '../../services/syncService.js';

export const getPelangganQuery = () => db.pelanggan.toArray();

export const getPelangganByIdQuery = async (id, fallbackNama = null) => {
  if (!id && !fallbackNama) return null;

  // 1. Jika ID berupa number murni (Dexie integer primary key)
  if (typeof id === 'number') {
    const item = await db.pelanggan.get(id);
    if (item) return item;
  }

  // 2. Jika ID berupa string angka murni (misal "12", bukan UUID "5f7d8347-...")
  if (typeof id === 'string' && /^\d+$/.test(id)) {
    const item = await db.pelanggan.get(parseInt(id, 10));
    if (item) return item;
  }

  // 3. Jika ID berupa UUID string (dari backend PostgreSQL / sync)
  if (typeof id === 'string' && id.includes('-')) {
    const item = await db.pelanggan.where('uuid').equals(id).first();
    if (item) return item;
  }

  // 4. Fallback: Cari berdasarkan nama jika ada
  if (fallbackNama) {
    const item = await db.pelanggan.filter(p => p.nama && p.nama.toLowerCase() === fallbackNama.toLowerCase().trim()).first();
    if (item) return item;
  }

  return null;
};

export const addPelanggan = async (pelangganData) => {
  const { nama, hp, alamat } = pelangganData;
  if (!nama || !hp) throw new Error('Nama dan No. HP wajib diisi');

  const existing = await db.pelanggan
    .where('nama').equalsIgnoreCase(nama)
    .or('hp').equals(hp)
    .first();

  if (existing) {
    throw new Error('Gagal! Nama atau No. HP sudah terdaftar.');
  }

  const newId = await db.pelanggan.add(withNewSyncMeta({ nama, hp, alamat: alamat || '' }));
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
  const result = await db.pelanggan.update(targetId, withUpdatedSyncMeta(pelangganData));
  syncPelangganToBackend().catch(err => console.warn('[Sync] Sync update pelanggan error:', err));
  return result;
};

