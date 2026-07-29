import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';

export const getPelangganQuery = () => db.pelanggan.toArray();

export const getPelangganByIdQuery = (id) => {
  if (!id) return null;
  return db.pelanggan.get(parseInt(id));
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

  return await db.pelanggan.add(withNewSyncMeta({ nama, hp, alamat: alamat || '' }));
};

export const updatePelanggan = async (id, pelangganData) => {
  if (!id) throw new Error('ID Pelanggan tidak valid');
  return await db.pelanggan.update(id, withUpdatedSyncMeta(pelangganData));
};
