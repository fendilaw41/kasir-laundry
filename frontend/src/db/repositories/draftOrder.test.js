import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDraftOrderQuery, updateDraftOrder, clearDraftOrder } from './draftOrder.js';
import { db } from '../../db.js';

vi.mock('../../db.js', () => ({
  db: {
    draftOrder: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    settings: {
      get: vi.fn(),
    },
    users: {
      toArray: vi.fn(),
    },
  },
}));

describe('draftOrder repository - multi-store isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('returns draft order if storeId matches active store', async () => {
    sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-1' }));
    db.draftOrder.get.mockResolvedValue({
      id: 'current',
      storeId: 'store-1',
      pelanggan: { id: 10, nama: 'Budi', storeId: 'store-1' },
    });

    const result = await getDraftOrderQuery();
    expect(result).not.toBeNull();
    expect(result.pelanggan.nama).toBe('Budi');
  });

  it('deletes draft and returns null if draft belongs to a different store', async () => {
    sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-2' }));
    db.draftOrder.get.mockResolvedValue({
      id: 'current',
      storeId: 'store-1',
      pelanggan: { id: 10, nama: 'Budi Store 1', storeId: 'store-1' },
    });

    const result = await getDraftOrderQuery();
    expect(result).toBeNull();
    expect(db.draftOrder.delete).toHaveBeenCalledWith('current');
  });

  it('removes pelanggan from draft if pelanggan belongs to a different store', async () => {
    sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-2' }));
    db.draftOrder.get.mockResolvedValue({
      id: 'current',
      storeId: 'store-2',
      pelanggan: { id: 10, nama: 'Budi Store 1', storeId: 'store-1' },
      inventory: [{ id: 1, qty: 1 }],
    });

    const result = await getDraftOrderQuery();
    expect(result).not.toBeNull();
    expect(result.pelanggan).toBeNull();
    expect(db.draftOrder.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'current',
      pelanggan: null,
    }));
  });

  it('updates draft order with current storeId', async () => {
    sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-3' }));
    db.draftOrder.get.mockResolvedValue(null);

    await updateDraftOrder({ pelanggan: { id: 5, nama: 'Siti', storeId: 'store-3' } });

    expect(db.draftOrder.put).toHaveBeenCalledWith(expect.objectContaining({
      id: 'current',
      storeId: 'store-3',
      pelanggan: { id: 5, nama: 'Siti', storeId: 'store-3' },
    }));
  });

  it('clears draft order', async () => {
    await clearDraftOrder();
    expect(db.draftOrder.delete).toHaveBeenCalledWith('current');
  });
});

