import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  encodeTrackingCode,
  decodeTrackingCode,
  maskPhoneNumber,
  getTrackingUrl,
  getShortDisplayUrl,
  fetchPublicOrder,
} from './tracking.js';
import { db } from '../db.js';

vi.mock('../db.js', () => ({
  db: {
    orders: {
      where: vi.fn(),
    },
    pelanggan: {
      get: vi.fn(),
      where: vi.fn(),
    },
    settings: {
      get: vi.fn(),
    },
  },
}));

describe('Tracking Utility - encode, decode & mask', () => {
  it('encode dan decode invoiceId secara bolak-balik tanpa merusak teks', () => {
    const invoices = ['KL-00001', 'DEV1-00042', 'INV-2026-999'];
    for (const inv of invoices) {
      const code = encodeTrackingCode(inv);
      expect(code).toBeTruthy();
      expect(code).not.toContain('/');
      expect(code).not.toContain('+');
      expect(code).not.toContain('=');

      const decoded = decodeTrackingCode(code);
      expect(decoded).toBe(inv);
    }
  });

  it('decode mengembalikan kode asli jika bukan format base64', () => {
    expect(decodeTrackingCode('KL-00012')).toBe('KL-00012');
  });

  it('maskPhoneNumber menyamarkan nomor telepon dengan benar', () => {
    expect(maskPhoneNumber('081234567890')).toBe('0812****890');
    expect(maskPhoneNumber('0812345')).toBe('0812345');
    expect(maskPhoneNumber('')).toBe('-');
  });

  it('menghasilkan tracking URL yang valid', () => {
    const url = getTrackingUrl('KL-00001', 'https://mylaaundry.com');
    expect(url).toContain('https://mylaaundry.com/c/');
    expect(url).toContain(encodeTrackingCode('KL-00001'));
  });

  it('menghasilkan short display URL untuk struk', () => {
    const display = getShortDisplayUrl('KL-00001', 'kasirlaundry.my.id');
    expect(display).toContain('kasirlaundry.my.id/c/');
  });
});

describe('fetchPublicOrder - Offline & Sync handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('mengambil dari Dexie lokal secara instan jika ada di database lokal saat offline', async () => {
    // Mock navigator offline
    vi.stubGlobal('navigator', { onLine: false });

    db.orders.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({
          id: 1,
          uuid: 'ord-123',
          invoiceId: 'KL-00001',
          total: 30000,
          status: 'Proses',
          statusBayar: 'Lunas',
          pelangganId: 10,
          items: [{ name: 'Cuci Komplit', quantity: 3, price: 10000, subtotal: 30000 }],
        }),
      }),
    });

    db.pelanggan.get.mockResolvedValue({
      id: 10,
      nama: 'Siti Aminah',
      hp: '081298765432',
    });

    db.settings.get.mockResolvedValue({
      namaLaundry: 'Laundry Cepat',
      alamat: 'Jl. Melati No. 5',
    });

    const result = await fetchPublicOrder('KL-00001');

    expect(result.order.invoiceId).toBe('KL-00001');
    expect(result.order.status).toBe('Proses');
    expect(result.order.pelanggan.nama).toBe('Siti Aminah');
    expect(result.order.pelanggan.hp).toBe('0812****432');
    expect(result.isOffline).toBe(true);
    expect(result.source).toBe('dexie-offline');

    vi.unstubAllGlobals();
  });

  it('mengambil dari API server dan menyimpan ke cache localStorage saat online', async () => {
    vi.stubGlobal('navigator', { onLine: true });

    db.orders.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    });

    const mockServerData = {
      id: 'ord-srv-1',
      invoiceId: 'KL-00099',
      shortCode: encodeTrackingCode('KL-00099'),
      status: 'Selesai',
      statusBayar: 'Lunas',
      total: 25000,
      items: [{ name: 'Cuci Kering', quantity: 2.5, price: 10000, subtotal: 25000 }],
      pelanggan: { nama: 'Rudi', hp: '0811****333' },
      store: { name: 'Klin Laundry' },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: mockServerData }),
    }));

    const result = await fetchPublicOrder('KL-00099');

    expect(result.order.invoiceId).toBe('KL-00099');
    expect(result.order.status).toBe('Selesai');
    expect(result.isOffline).toBe(false);
    expect(result.source).toBe('server');

    // Pastikan tersimpan ke localStorage
    expect(localStorage.getItem('tracked_order_KL-00099')).toBeTruthy();

    vi.unstubAllGlobals();
  });
});

