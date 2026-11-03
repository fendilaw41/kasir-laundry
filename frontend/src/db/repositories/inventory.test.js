import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInventoryQuery, getInventoryById, addInventoryManual } from './inventory.js';
import { db } from '../../db.js';

vi.mock('../../services/syncService.js', () => ({
  syncInventoryToBackend: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../db.js', () => ({
  db: {
    inventory: {
      get: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn()
    },
    inventoryEvents: {
      add: vi.fn()
    },
    settings: {
      get: vi.fn()
    },
    transaction: vi.fn(async (mode, tables, callback) => {
      await callback();
    })
  }
}));

describe('inventory repository - storeId scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('getInventoryQuery', () => {
    it('should filter items by active storeId', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      const mockItems = [
        { id: 1, nama: 'Deterjen', stok: 10, storeId: 'store-123' },
        { id: 2, nama: 'Pewangi', stok: 5, storeId: 'store-OTHER' },
        { id: 3, nama: 'Plastik', stok: 0, storeId: 'store-123', deletedAt: new Date() }
      ];
      db.inventory.toArray.mockResolvedValue(mockItems);

      const items = await getInventoryQuery();
      expect(items).toHaveLength(1);
      expect(items[0].nama).toBe('Deterjen');
    });
  });

  describe('getInventoryById', () => {
    it('should return item if storeId matches', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.inventory.get.mockResolvedValue({ id: 1, nama: 'Deterjen', storeId: 'store-123' });

      const item = await getInventoryById(1);
      expect(item).not.toBeNull();
      expect(item.nama).toBe('Deterjen');
    });

    it('should return null if item belongs to a different storeId', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.inventory.get.mockResolvedValue({ id: 1, nama: 'Deterjen', storeId: 'store-OTHER' });

      const item = await getInventoryById(1);
      expect(item).toBeNull();
    });
  });

  describe('addInventoryManual', () => {
    it('should attach active storeId when adding new inventory', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.inventory.toArray.mockResolvedValue([]);
      db.inventory.add.mockResolvedValue(55);

      const id = await addInventoryManual('Parfum', 10);
      expect(id).toBe(55);
      expect(db.inventory.add).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 'store-123',
        nama: 'Parfum',
        stok: 10,
        status: 'approved'
      }));
    });

    it('should set status: pending and stok: 0 when isPending is true for new item', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.inventory.toArray.mockResolvedValue([]);
      db.inventory.add.mockResolvedValue(99);

      const id = await addInventoryManual('Deterjen Matic', 5, { isPending: true, user: { fullname: 'Kasir Andi' } });
      expect(id).toBe(99);
      expect(db.inventory.add).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 'store-123',
        nama: 'Deterjen Matic',
        stok: 0,
        qty: 5,
        status: 'pending',
        createdBy: 'Kasir Andi'
      }));
    });

    it('should update qty and set status: pending without changing stok for existing item', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      const existing = [{ id: 10, nama: 'Pewangi Mawar', stok: 8, qty: 0, status: 'approved', storeId: 'store-123' }];
      db.inventory.toArray.mockResolvedValue(existing);

      const id = await addInventoryManual('Pewangi Mawar', 4, { isPending: true, user: { fullname: 'Kasir Andi' } });
      expect(id).toBe(10);
      expect(db.inventory.update).toHaveBeenCalledWith(10, expect.objectContaining({
        qty: 4,
        status: 'pending',
        createdBy: 'Kasir Andi'
      }));
    });
  });
});
