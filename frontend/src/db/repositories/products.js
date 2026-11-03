import { db } from '../../db.js';
import { getActiveStoreId } from './storeHelper.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncProductsToBackend } from '../../services/syncService.js';

export const getProductsQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.products.toArray();
  const nonDeleted = all.filter(p => !p.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(p => !p.storeId || p.storeId === storeId);
};

export const addProduct = async (productData) => {
  if (!productData?.name?.trim()) {
    throw new Error('Nama layanan wajib diisi.');
  }
  const price = Number(productData.price);
  if (isNaN(price) || price < 0) {
    throw new Error('Harga layanan harus berupa angka valid (minimal 0).');
  }

  const storeId = await getActiveStoreId();
  const payload = withNewSyncMeta({
    storeId: storeId || undefined,
    code: (productData.code || '').trim().toUpperCase() || null,
    category: (productData.category || '').trim().toUpperCase() || 'LAINNYA',
    name: productData.name.trim(),
    price: price,
  });

  const newId = await db.products.add(payload);
  syncProductsToBackend(false).catch(err => console.warn('[Sync] Sync product error:', err));
  return newId;
};

export const updateProduct = async (id, productData) => {
  if (!id) throw new Error('ID layanan tidak valid.');
  if (!productData?.name?.trim()) {
    throw new Error('Nama layanan wajib diisi.');
  }
  const price = Number(productData.price);
  if (isNaN(price) || price < 0) {
    throw new Error('Harga layanan harus berupa angka valid (minimal 0).');
  }

  const numId = parseInt(id, 10);
  const target = (await db.products.get(numId)) || (await db.products.where('uuid').equals(id).first());
  if (!target) throw new Error('Layanan tidak ditemukan.');

  const storeId = await getActiveStoreId();
  const updatePayload = withUpdatedSyncMeta({
    ...(storeId && !target.storeId ? { storeId } : {}),
    code: (productData.code || '').trim().toUpperCase() || null,
    category: (productData.category || '').trim().toUpperCase() || 'LAINNYA',
    name: productData.name.trim(),
    price: price,
  });

  await db.products.update(target.id, updatePayload);
  syncProductsToBackend(false).catch(err => console.warn('[Sync] Sync product error:', err));
  return target.id;
};

export const deleteProduct = async (id) => {
  if (!id) throw new Error('ID layanan tidak valid.');
  const numId = parseInt(id, 10);
  const target = (await db.products.get(numId)) || (await db.products.where('uuid').equals(id).first());
  if (!target) throw new Error('Layanan tidak ditemukan.');

  await db.products.update(target.id, withUpdatedSyncMeta({
    deletedAt: new Date(),
  }));
  syncProductsToBackend(false).catch(err => console.warn('[Sync] Sync product error:', err));
  return target.id;
};
