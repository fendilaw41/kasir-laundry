import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BukuKas, { findMatchingInventoryItems } from './BukuKas';
import * as cashRepo from '../db/repositories/cashEntries';
import * as invRepo from '../db/repositories/inventory';

// Mock dependencies
vi.mock('../db/repositories/cashEntries', () => ({
  getCashEntriesQuery: vi.fn(),
  addCashEntry: vi.fn().mockResolvedValue({ uuid: 'new-uuid-1' }),
  updateCashEntry: vi.fn().mockResolvedValue({}),
  deleteCashEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../db/repositories/orders', () => ({
  getOrdersSortedByDateQuery: vi.fn(),
}));

vi.mock('../db/repositories/inventory', () => ({
  getInventoryQuery: vi.fn(),
  addInventoryManual: vi.fn().mockResolvedValue(1),
}));

const mockCashEntries = [
  {
    uuid: 'cash-1',
    type: 'OUT',
    amount: 120000,
    category: 'bahan',
    method: 'tunai',
    note: 'Beli Deterjen',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    source: 'MANUAL',
  },
  {
    uuid: 'cash-2',
    type: 'IN',
    amount: 500000,
    category: 'modal',
    method: 'transfer',
    note: 'Tambah Modal Usaha',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    source: 'MANUAL',
  },
];

const mockOrders = [
  {
    id: 101,
    invoiceId: 'INV-101',
    pelangganNama: 'Pelanggan A',
    total: 75000,
    statusBayar: 'Lunas',
    metodeBayar: 'Cash',
    status: 'Selesai',
    createdAt: new Date().toISOString(),
  },
];

const mockInventory = [
  { id: 1, nama: 'Deterjen 500ml', stok: 10, unit: 'botol', isActive: true },
  { id: 2, nama: 'Deterjen 200ml', stok: 5, unit: 'botol', isActive: true },
  { id: 3, nama: 'Deterjen Bubuk Nonaktif', stok: 0, unit: 'kg', isActive: false },
  { id: 4, nama: 'Plastik 35', stok: 20, unit: 'pack', isActive: true },
];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn) => {
    if (fn === cashRepo.getCashEntriesQuery) return mockCashEntries;
    if (fn === invRepo.getInventoryQuery) return mockInventory;
    return mockOrders;
  }),
}));

describe('BukuKas Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findMatchingInventoryItems helper', () => {
    it('mencocokkan nama catatan dengan stok aktif secara cerdas', () => {
      const matches = findMatchingInventoryItems('Deterjen', mockInventory);
      // Hanya stok aktif yang cocok (Deterjen 500ml dan Deterjen 200ml, TIDAK termasuk yang nonaktif)
      expect(matches).toHaveLength(2);
      expect(matches[0].nama).toBe('Deterjen 500ml');
      expect(matches[1].nama).toBe('Deterjen 200ml');
    });

    it('mengabaikan stok yang nonaktif (isActive: false) meskipun namanya cocok', () => {
      const matches = findMatchingInventoryItems('Deterjen Bubuk', mockInventory);
      expect(matches).toHaveLength(2); // hanya 500ml dan 200ml yang aktif, Deterjen Bubuk nonaktif di-filter out
      expect(matches.some((m) => m.nama === 'Deterjen Bubuk Nonaktif')).toBe(false);
    });

    it('mendukung pencocokan dengan kalimat seperti "Beli deterjen 5 bungkus"', () => {
      const matches = findMatchingInventoryItems('Beli deterjen 5 bungkus', mockInventory);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.some((m) => m.nama === 'Deterjen 500ml')).toBe(true);
    });

    it('mengembalikan array kosong jika tidak ada kemiripan', () => {
      const matches = findMatchingInventoryItems('Sewa Tempat Usaha', mockInventory);
      expect(matches).toHaveLength(0);
    });
  });

  it('merender Buku Kas dengan ringkasan saldo, uang masuk, dan pengeluaran', () => {
    render(
      <MemoryRouter>
        <BukuKas user={{ role: 'owner', username: 'owner' }} />
      </MemoryRouter>
    );

    // Judul & Periode
    expect(screen.getAllByText('Hari ini').length).toBeGreaterThan(0);
    expect(screen.getByText('Saldo kas')).toBeDefined();

    // Data dari cash manual & order masuk
    // Pengeluaran: 120.000 (Deterjen)
    // Masuk: 500.000 (Modal) + 75.000 (Order) = 575.000
    // Saldo: 575.000 - 120.000 = 455.000
    expect(screen.getAllByText(/455\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/575\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0);

    // Pastikan order otomatis muncul sebagai uang masuk
    expect(screen.getByText('Order INV-101')).toBeDefined();
    expect(screen.getByText('Deterjen & bahan')).toBeDefined();
  });

  it('membuka modal bottom sheet saat tombol Catat Kas ditekan', () => {
    render(
      <MemoryRouter>
        <BukuKas user={{ role: 'kasir', username: 'kasir' }} />
      </MemoryRouter>
    );

    const fabBtn = screen.getByLabelText('Catat kas');
    fireEvent.click(fabBtn);

    expect(screen.getByText('Uang Keluar')).toBeDefined();
    expect(screen.getByText('Uang Masuk')).toBeDefined();
    expect(screen.getByLabelText('Nominal')).toBeDefined();
  });

  it('menyimpan transaksi pengeluaran baru saat form diisi dan disimpan', async () => {
    render(
      <MemoryRouter>
        <BukuKas user={{ role: 'kasir', username: 'kasir' }} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Catat kas'));

    // Input nominal
    const nominalInput = screen.getByLabelText('Nominal');
    fireEvent.change(nominalInput, { target: { value: '35000' } });

    // Klik simpan
    const saveBtn = screen.getByText('Simpan');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(cashRepo.addCashEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OUT',
          amount: 35000,
          category: 'bahan',
          method: 'tunai',
        })
      );
    });
  });

  it('menampilkan popup konfirmasi update stok otomatis jika nama pengeluaran mirip stok aktif (misal Deterjen)', async () => {
    render(
      <MemoryRouter>
        <BukuKas user={{ role: 'owner', username: 'owner' }} />
      </MemoryRouter>
    );

    // Buka form catat kas
    fireEvent.click(screen.getByLabelText('Catat kas'));

    // Masukkan nominal & catatan "Deterjen"
    fireEvent.change(screen.getByLabelText('Nominal'), { target: { value: '45000' } });
    fireEvent.change(screen.getByPlaceholderText(/Catatan \/ nama barang/i), {
      target: { value: 'Deterjen' },
    });

    // Simpan kas
    fireEvent.click(screen.getByText('Simpan'));

    // Pastikan cash entry tersimpan
    await waitFor(() => {
      expect(cashRepo.addCashEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OUT',
          amount: 45000,
          note: 'Deterjen',
        })
      );
    });

    // Popup konfirmasi update stok harus muncul otomatis dengan daftar stok yang aktif
    expect(screen.getByText('Update Stok Barang?')).toBeDefined();
    expect(screen.getByText('Deterjen 500ml')).toBeDefined();
    expect(screen.getByText('Deterjen 200ml')).toBeDefined();
    // Deterjen Bubuk nonaktif tidak boleh muncul
    expect(screen.queryByText('Deterjen Bubuk Nonaktif')).toBeNull();

    // Pilih Deterjen 200ml
    fireEvent.click(screen.getByText('Deterjen 200ml'));

    // Klik Tambah Stok (+1)
    const tambahBtn = screen.getByText(/Tambah Stok/i);
    fireEvent.click(tambahBtn);

    await waitFor(() => {
      expect(invRepo.addInventoryManual).toHaveBeenCalledWith(
        'Deterjen 200ml',
        1,
        expect.objectContaining({ isPending: false })
      );
    });
  });

  it('memungkinkan pengguna untuk melewati (skip) update stok tanpa menambah stok', async () => {
    render(
      <MemoryRouter>
        <BukuKas user={{ role: 'owner', username: 'owner' }} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Catat kas'));
    fireEvent.change(screen.getByLabelText('Nominal'), { target: { value: '25000' } });
    fireEvent.change(screen.getByPlaceholderText(/Catatan \/ nama barang/i), {
      target: { value: 'Deterjen' },
    });
    fireEvent.click(screen.getByText('Simpan'));

    await waitFor(() => {
      expect(screen.getByText('Update Stok Barang?')).toBeDefined();
    });

    // Klik Tidak, Lewati
    fireEvent.click(screen.getByText('Tidak, Lewati'));

    // Popup tertutup dan addInventoryManual tidak dipanggil
    expect(screen.queryByText('Update Stok Barang?')).toBeNull();
    expect(invRepo.addInventoryManual).not.toHaveBeenCalled();
  });

  it('kasir tidak dapat mengklik untuk mengedit catatan pengeluaran, tetapi owner bisa', () => {
    const { rerender } = render(
      <MemoryRouter>
        <BukuKas user={{ role: 'kasir', username: 'kasir' }} />
      </MemoryRouter>
    );

    // Pada kasir, baris manual bukan button interaktif edit
    const deterjenEl = screen.getByText('Deterjen & bahan');
    const rowEl = deterjenEl.closest('.kb-row');
    expect(rowEl.tagName).toBe('DIV');

    // Pada owner, baris manual adalah button yang bisa diklik untuk edit/hapus
    rerender(
      <MemoryRouter>
        <BukuKas user={{ role: 'owner', username: 'owner' }} />
      </MemoryRouter>
    );

    const rowOwnerEl = screen.getByText('Deterjen & bahan').closest('.kb-row');
    expect(rowOwnerEl.tagName).toBe('BUTTON');
  });
});
