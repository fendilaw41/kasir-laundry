import { db } from '../../db.js';
import { getActiveStoreId } from './storeHelper.js';

const DRAFT_ID = 'current';

export const getDraftOrderQuery = async () => {
  const draft = await db.draftOrder.get(DRAFT_ID);
  if (!draft) return null;
  const storeId = await getActiveStoreId();
  // Jika draft memiliki storeId dan storeId berbeda dari toko yang sedang aktif, hapus draft
  if (storeId && draft.storeId && draft.storeId !== storeId) {
    await db.draftOrder.delete(DRAFT_ID);
    return null;
  }
  // Jika draft memiliki pelanggan dari store lain, hapus pelanggan dari draft
  if (storeId && draft.pelanggan?.storeId && draft.pelanggan.storeId !== storeId) {
    const cleaned = { ...draft, pelanggan: null };
    await db.draftOrder.put(cleaned);
    return cleaned;
  }
  return draft;
};

export const updateDraftOrder = async (updates) => {
  const storeId = await getActiveStoreId();
  const existing = await db.draftOrder.get(DRAFT_ID) || {};
  if (storeId && existing.storeId && existing.storeId !== storeId) {
    await db.draftOrder.put({ id: DRAFT_ID, storeId, ...updates });
  } else {
    await db.draftOrder.put({ ...existing, id: DRAFT_ID, storeId: storeId || existing.storeId, ...updates });
  }
};

export const clearDraftOrder = async () => {
  await db.draftOrder.delete(DRAFT_ID);
};
