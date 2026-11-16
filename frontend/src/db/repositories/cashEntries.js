// src/db/repositories/cashEntries.js
// Repositori Buku Kas (pemasukan & pengeluaran MANUAL). Uang masuk dari order tidak disimpan di sini:
// ia dihitung dari data order (lihat adaptor orderToEntries di BukuKas.jsx) supaya tidak ada hitungan ganda.
import { db } from '../../db.js';
import { getActiveStoreId } from './storeHelper.js';
import { syncCashEntriesToBackend } from '../../services/syncService.js';

// Daftar entri yang belum dihapus (soft delete) untuk toko aktif
export const getCashEntriesQuery = async () => {
  try {
    const storeId = await getActiveStoreId();
    const all = await db.cashEntries.filter((e) => !e.deletedAt).toArray();
    if (!storeId) return all;
    return all.filter((e) => !e.storeId || e.storeId === storeId);
  } catch (err) {
    console.warn('[CashEntries] Gagal membaca data kas:', err);
    return [];
  }
};

export async function addCashEntry(data) {
  const now = new Date().toISOString();
  const storeId = data.storeId || (await getActiveStoreId());
  const entry = {
    uuid: data.uuid || crypto.randomUUID(), // dibuat di klien agar aman offline & mudah disinkronkan
    storeId: storeId || undefined,
    source: data.source || 'MANUAL',
    deletedAt: null,
    createdAt: data.createdAt || now,
    updatedAt: now,
    syncStatus: 'pending',
    isDirty: 1,
    ...data,
    amount: Math.round(Number(data.amount) || 0), // rupiah bulat
  };
  await db.cashEntries.add(entry);

  // Background sync ke backend jika online
  syncCashEntriesToBackend().catch((err) => {
    console.warn('[SyncCash] Auto-sync gagal:', err?.message);
  });

  return entry;
}

export async function updateCashEntry(uuid, patch) {
  const next = {
    ...patch,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
    isDirty: 1,
  };
  if (next.amount !== undefined) {
    next.amount = Math.round(Number(next.amount) || 0);
  }
  await db.cashEntries.update(uuid, next);

  // Background sync ke backend jika online
  syncCashEntriesToBackend().catch((err) => {
    console.warn('[SyncCash] Auto-sync gagal:', err?.message);
  });
}

// Hapus lunak: baris tetap ada (jejak audit) dan ikut tersinkron ke server
export async function deleteCashEntry(uuid) {
  const now = new Date().toISOString();
  await db.cashEntries.update(uuid, {
    deletedAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    isDirty: 1,
  });

  // Background sync ke backend jika online
  syncCashEntriesToBackend().catch((err) => {
    console.warn('[SyncCash] Auto-sync gagal:', err?.message);
  });
}
