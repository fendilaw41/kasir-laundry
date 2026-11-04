import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPelangganQuery, getPelangganByIdQuery, addPelanggan, deletePelanggan } from './pelanggan.js';
import { db } from '../../db.js';

vi.mock('../../services/syncService.js', () => ({
  syncPelangganToBackend: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../db.js', () => ({
  db: {
    pelanggan: {
      get: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      where: vi.fn(),
      filter: vi.fn()
    },
    orders: {
      toArray: vi.fn()
    },
    settings: {
      get: vi.fn()
    }
  }
}));

describe('pelanggan repository - storeId scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('getPelangganQuery', () => {
    it('should filter customers by active storeId', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      const mockData = [
        { id: 1, nama: 'Budi', hp: '08111', storeId: 'store-123' },
        { id: 2, nama: 'Siti', hp: '08222', storeId: 'store-456' },
        { id: 3, nama: 'Joko', hp: '08333', storeId: 'store-123', deletedAt: new Date() }
      ];
      db.pelanggan.toArray.mockResolvedValue(mockData);

      const result = await getPelangganQuery();

      expect(result).toHaveLength(1);
      expect(result[0].nama).toBe('Budi');
      expect(result[0].storeId).toBe('store-123');
    });

    it('should return all non-deleted customers if no storeId exists', async () => {
      db.settings.get.mockResolvedValue(null);
      const mockData = [
        { id: 1, nama: 'Budi', hp: '08111' },
        { id: 2, nama: 'Siti', hp: '08222', deletedAt: new Date() }
      ];
      db.pelanggan.toArray.mockResolvedValue(mockData);

      const result = await getPelangganQuery();

      expect(result).toHaveLength(1);
      expect(result[0].nama).toBe('Budi');
    });
  });

  describe('getPelangganByIdQuery', () => {
    it('should return customer by ID if storeId matches', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.pelanggan.get.mockResolvedValue({ id: 10, nama: 'Rina', storeId: 'store-123' });

      const item = await getPelangganByIdQuery(10);
      expect(item).not.toBeNull();
      expect(item.nama).toBe('Rina');
    });

    it('should return null if customer belongs to a different storeId', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.pelanggan.get.mockResolvedValue({ id: 10, nama: 'Rina', storeId: 'store-OTHER' });

      const item = await getPelangganByIdQuery(10);
      expect(item).toBeNull();
    });

    it('should return customer by UUID if storeId matches', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      db.pelanggan.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 5, uuid, nama: 'Andi', storeId: 'store-123' })
        })
      });

      const item = await getPelangganByIdQuery(uuid);
      expect(item).not.toBeNull();
      expect(item.nama).toBe('Andi');
    });
  });

  describe('addPelanggan', () => {
    it('should assign active storeId when adding a new customer', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.pelanggan.toArray.mockResolvedValue([]);
      db.pelanggan.add.mockResolvedValue(99);

      const id = await addPelanggan({ nama: 'Pelanggan Baru', hp: '0812345678', alamat: 'Jl. Merdeka' });
      expect(id).toBe(99);

      expect(db.pelanggan.add).toHaveBeenCalledWith(expect.objectContaining({
        storeId: 'store-123',
        nama: 'Pelanggan Baru',
        hp: '0812345678',
        alamat: 'Jl. Merdeka'
      }));
    });

    it('should throw an error if same customer already exists in the same store', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.pelanggan.toArray.mockResolvedValue([
        { id: 1, nama: 'Budi', hp: '0812345678', storeId: 'store-123' }
      ]);

      await expect(addPelanggan({ nama: 'Budi', hp: '0812345678' }))
        .rejects.toThrow('Gagal! Nama atau No. HP sudah terdaftar.');
    });

    it('should allow same customer name/hp if in a different store', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.pelanggan.toArray.mockResolvedValue([
        { id: 1, nama: 'Budi', hp: '0812345678', storeId: 'store-DIFFERENT' }
      ]);
      db.pelanggan.add.mockResolvedValue(100);

      const id = await addPelanggan({ nama: 'Budi', hp: '0812345678' });
      expect(id).toBe(100);
      expect(db.pelanggan.add).toHaveBeenCalled();
    });
  });

  describe('deletePelanggan', () => {
    it('should throw error if customer not found', async () => {
      db.pelanggan.get.mockResolvedValue(null);
      await expect(deletePelanggan(999)).rejects.toThrow('Pelanggan tidak ditemukan');
    });

    it('should block deletion if customer has active orders', async () => {
      db.pelanggan.get.mockResolvedValue({ id: 1, nama: 'Budi' });
      db.orders.toArray.mockResolvedValue([
        { id: 101, pelangganId: 1, status: 'Proses' }
      ]);

      await expect(deletePelanggan(1)).rejects.toThrow('Pelanggan masih memiliki order aktif. Batalkan order terlebih dahulu.');
    });

    it('should allow deletion if customer orders are all cancelled (Dibatalkan)', async () => {
      db.pelanggan.get.mockResolvedValue({ id: 1, nama: 'Budi' });
      db.orders.toArray.mockResolvedValue([
        { id: 101, pelangganId: 1, status: 'Dibatalkan' }
      ]);
      db.pelanggan.update.mockResolvedValue(1);

      const res = await deletePelanggan(1);
      expect(res).toBe(1);
      expect(db.pelanggan.update).toHaveBeenCalledWith(1, expect.objectContaining({
        deletedAt: expect.any(Date),
        isDirty: 1
      }));
    });

    it('should allow deletion if customer has no orders', async () => {
      db.pelanggan.get.mockResolvedValue({ id: 2, nama: 'Siti' });
      db.orders.toArray.mockResolvedValue([]);
      db.pelanggan.update.mockResolvedValue(1);

      const res = await deletePelanggan(2);
      expect(res).toBe(1);
      expect(db.pelanggan.update).toHaveBeenCalledWith(2, expect.objectContaining({
        deletedAt: expect.any(Date),
        isDirty: 1
      }));
    });

    it('should accept customer object directly and set isDirty: 1', async () => {
      db.pelanggan.get.mockResolvedValue({ id: 3, nama: 'Rudi', uuid: 'uuid-3' });
      db.orders.toArray.mockResolvedValue([]);
      db.pelanggan.update.mockResolvedValue(1);

      const res = await deletePelanggan({ id: 3, nama: 'Rudi', uuid: 'uuid-3' });
      expect(res).toBe(1);
      expect(db.pelanggan.update).toHaveBeenCalledWith(3, expect.objectContaining({
        deletedAt: expect.any(Date),
        isDirty: 1
      }));
    });
  });
});
