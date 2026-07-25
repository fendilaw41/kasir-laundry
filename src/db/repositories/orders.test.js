import { describe, it, expect, vi } from 'vitest';
import { createOrderFromCheckout } from './orders';
import { db } from '../../db.js';

vi.mock('../../db.js', () => ({
  db: {
    orders: { add: vi.fn(), get: vi.fn(), toArray: vi.fn() },
    inventory: { get: vi.fn(), update: vi.fn() },
    cart: { clear: vi.fn() },
    settings: { get: vi.fn(), update: vi.fn() },
    transaction: vi.fn(async (mode, tables, callback) => {
      await callback();
    })
  }
}));

describe('orders repository', () => {
  describe('createOrderFromCheckout', () => {
    it('should throw an error if orderData is invalid or missing total', async () => {
      await expect(createOrderFromCheckout({})).rejects.toThrow('Data order tidak valid');
      await expect(createOrderFromCheckout({ orderData: null })).rejects.toThrow('Data order tidak valid');
    });

    it('should throw an error if total is negative and no cart items', async () => {
      await expect(createOrderFromCheckout({ orderData: { total: -5000 } })).rejects.toThrow('Total order tidak valid');
    });

    it('should proceed and add order if valid', async () => {
      db.settings.get.mockResolvedValue({ namaLaundry: 'KASIR TEST', lastInvoiceNumber: 10 });
      db.orders.add.mockResolvedValue(1);

      const orderData = { total: 50000, cartItems: [{ id: 1, name: 'Cuci', price: 50000, qty: 1 }] };
      const newId = await createOrderFromCheckout({ orderData, bayarNum: 50000, kembalian: 0, isLunas: true });

      expect(newId).toBe(1);
      expect(db.orders.add).toHaveBeenCalled();
      expect(db.cart.clear).toHaveBeenCalled();
      
      const addedOrder = db.orders.add.mock.calls[0][0];
      expect(addedOrder.statusBayar).toBe('Lunas');
      expect(addedOrder.invoiceId).toBe('KT00011');
    });
  });
});
