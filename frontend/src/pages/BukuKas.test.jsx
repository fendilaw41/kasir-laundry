import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BukuKas from './BukuKas';
import * as cashRepo from '../db/repositories/cashEntries';

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

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn) => {
    if (fn === cashRepo.getCashEntriesQuery) return mockCashEntries;
    return mockOrders;
  }),
}));

describe('BukuKas Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
