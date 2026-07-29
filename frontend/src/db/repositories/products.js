import { db } from '../../db.js';

export const getProductsQuery = () => {
  return db.products.toArray();
};
