import { db } from '../../db.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
export const getCartQuery = () => db.cart.toArray();

export const addProductToCart = async (product, qty = 1) => {
  if (!product || !product.id) throw new Error('Produk tidak valid');
  const parsedQty = parseInt(Number(qty));
  const validQty = isNaN(parsedQty) || parsedQty < 1 ? 1 : parsedQty;

  const existing = await db.cart.where('productId').equals(product.id).first();
  if (existing) {
    return await db.cart.update(existing.id, withUpdatedSyncMeta({ quantity: existing.quantity + validQty }));
  } else {
    return await db.cart.add(withNewSyncMeta({
      productId: product.id,
      quantity: validQty,
      name: `${product.category} - ${product.name}`,
      price: product.price
    }));
  }
};

export const removeProductFromCart = async (id) => {
  if (!id) throw new Error('ID tidak valid');
  return await db.cart.delete(id);
};

export const updateCartItemQty = async (id, delta) => {
  if (!id) throw new Error('ID tidak valid');
  const item = await db.cart.get(id);
  if (!item) throw new Error('Item tidak ditemukan');

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    return await db.cart.delete(id);
  } else {
    return await db.cart.update(id, withUpdatedSyncMeta({ quantity: newQty }));
  }
};
