import { db } from '../../db.js';
import { getActiveStoreId } from './storeHelper.js';

export const getProductsQuery = async () => {
  const storeId = await getActiveStoreId();
  const all = await db.products.toArray();
  const nonDeleted = all.filter(p => !p.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(p => !p.storeId || p.storeId === storeId);
};
