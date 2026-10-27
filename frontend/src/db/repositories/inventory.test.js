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
        stok: 10
      }));
    });
  });
});
