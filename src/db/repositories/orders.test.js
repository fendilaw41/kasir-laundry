import { describe, it, expect, vi } from 'vitest';
import { createOrderFromCheckout, updateOrder } from './orders';
import { db } from '../../db.js';

vi.mock('../../db.js', () => ({
  db: {
    orders: { add: vi.fn(), get: vi.fn(), toArray: vi.fn(), update: vi.fn() },
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
      db.settings.get.mockResolvedValue({ deviceId: 'TEST', namaLaundry: 'KASIR TEST', lastInvoiceNumber: 10 });
      db.orders.add.mockResolvedValue(1);

      const orderData = { total: 50000, cartItems: [{ id: 1, name: 'Cuci', price: 50000, qty: 1 }] };
      const newId = await createOrderFromCheckout({ orderData, bayarNum: 50000, kembalian: 0, isLunas: true });

      expect(newId).toBe(1);
      expect(db.orders.add).toHaveBeenCalled();
      expect(db.cart.clear).toHaveBeenCalled();
      
      const addedOrder = db.orders.add.mock.calls[0][0];
      expect(addedOrder.statusBayar).toBe('Lunas');
      expect(addedOrder.invoiceId).toBe('TEST-00011');
    });
  });

  describe('updateOrder', () => {
    it('should throw an error if updating to Ambil but not Lunas', async () => {
      db.orders.get.mockResolvedValue({ id: 1, statusBayar: 'DP', inventoryUsed: [{ nama: 'Deterjen', quantity: 1 }] });
      await expect(updateOrder(1, { status: 'Ambil' }))
        .rejects.toThrow('Pesanan belum lunas! Tidak bisa diambil.');
    });

    it('should throw an error if updating to Ambil but no Deterjen used', async () => {
      db.orders.get.mockResolvedValue({ id: 1, statusBayar: 'Lunas', inventoryUsed: [{ nama: 'Pewangi', quantity: 1 }] });
      await expect(updateOrder(1, { status: 'Ambil' }))
        .rejects.toThrow('Inventory terpakai minimal harus ada Deterjen 1x untuk dipindah ke status Ambil.');
    });
    
    it('should throw an error if updating to Selesai but no Deterjen used', async () => {
      db.orders.get.mockResolvedValue({ id: 1, statusBayar: 'Belum Bayar', inventoryUsed: [] });
      await expect(updateOrder(1, { status: 'Selesai' }))
        .rejects.toThrow('Inventory terpakai minimal harus ada Deterjen 1x untuk dipindah ke status Selesai.');
    });

    it('should successfully update to Ambil if Lunas and has Deterjen', async () => {
      db.orders.get.mockResolvedValue({ id: 1, statusBayar: 'Lunas', inventoryUsed: [{ nama: 'Deterjen Bubuk', quantity: 2 }] });
      db.orders.update.mockResolvedValue(1);
      
      const res = await updateOrder(1, { status: 'Ambil' });
      
      expect(res).toBe(1);
      expect(db.orders.update).toHaveBeenCalledWith(1, { status: 'Ambil' });
    });
  });
});
