import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Reports, { getAllowedMonths } from './Reports';

// Capture liveQuery callback for unit-testing the filtering logic directly
let capturedQueryCallback = null;
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((callback) => {
    capturedQueryCallback = callback;
    return [];
  }),
}));

const mockOrders = [
  // 1. Order hari ini
  {
    id: 1,
    invoiceId: 'INV-TODAY',
    pelangganNama: 'Budi Hari Ini',
    total: 50000,
    statusBayar: 'Lunas',
    createdAt: new Date().toISOString(),
  },
  // 2. Order 15 hari lalu (masih dalam 1 bulan / 30 hari terakhir)
  {
    id: 2,
    invoiceId: 'INV-15DAYS',
    pelangganNama: 'Siti 15 Hari',
    total: 75000,
    statusBayar: 'Lunas',
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // 3. Order 50 hari lalu (lebih dari 1 bulan, masih dalam 3 bulan terakhir)
  {
    id: 3,
    invoiceId: 'INV-50DAYS',
    pelangganNama: 'Agus 50 Hari',
    total: 100000,
    statusBayar: 'Lunas',
    createdAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
  },
  // 4. Order 120 hari lalu (lebih dari 3 bulan)
  {
    id: 4,
    invoiceId: 'INV-120DAYS',
    pelangganNama: 'Dewi 120 Hari',
    total: 120000,
    statusBayar: 'Lunas',
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock orders repository
vi.mock('../db/repositories/orders', () => ({
  getOrdersSortedByDateQuery: vi.fn().mockImplementation(() => Promise.resolve(mockOrders)),
}));

// Mock syncService
vi.mock('../services/syncService', () => ({
  pullOrdersFromBackend: vi.fn().mockResolvedValue(true),
  syncTwoWay: vi.fn().mockResolvedValue(true),
}));

describe('Reports Page - Filter Tanggal & Role Kasir Restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    capturedQueryCallback = null;
  });

  describe('getAllowedMonths helper', () => {
    it('mengembalikan 3 bulan terakhir untuk role owner', () => {
      const months = getAllowedMonths('owner');
      expect(months).toHaveLength(3);
      expect(months[0].label).toContain('(Bulan Ini)');
    });

    it('mengembalikan hanya 1 bulan terakhir untuk role kasir', () => {
      const months = getAllowedMonths('kasir');
      expect(months).toHaveLength(1);
      expect(months[0].label).toContain('(Bulan Ini)');
    });
  });

  describe('Sembunyikan filter tanggal saat pilih Hari Ini', () => {
    it('menyembunyikan tombol filter tanggal / slider saat query param today=true', () => {
      render(
        <MemoryRouter initialEntries={['/reports?today=true']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      // Icon slider untuk filter bulan & periode harus di-hide
      expect(screen.queryByLabelText('Filter Bulan & Periode')).toBeNull();
      expect(screen.queryByTitle('Filter Bulan & Periode')).toBeNull();
      // Form filter bulan juga tidak boleh muncul
      expect(screen.queryByLabelText('Pilih Bulan')).toBeNull();
    });

    it('menampilkan tombol filter tanggal saat bukan mode Hari Ini (Semua Periode)', () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      // Icon slider untuk filter bulan & periode harus muncul
      const filterButton = screen.getByLabelText('Filter Bulan & Periode');
      expect(filterButton).toBeDefined();

      // Klik filter button untuk membuka filter bulan
      fireEvent.click(filterButton);
      expect(screen.getByLabelText('Pilih Bulan')).toBeDefined();
    });

    it('menutup filter saat beralih dari Semua Periode ke Hari Ini', () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      // Buka filter
      const filterButton = screen.getByLabelText('Filter Bulan & Periode');
      fireEvent.click(filterButton);
      expect(screen.getByLabelText('Pilih Bulan')).toBeDefined();

      // Klik tombol Hari Ini
      const todayButton = screen.getByRole('button', { name: /Hari Ini/i });
      fireEvent.click(todayButton);

      // Filter harus tertutup dan tombol slider hilang
      expect(screen.queryByLabelText('Pilih Bulan')).toBeNull();
      expect(screen.queryByLabelText('Filter Bulan & Periode')).toBeNull();
    });
  });

  describe('Filter per bulan untuk role Owner vs Kasir', () => {
    it('menampilkan opsi 3 bulan terakhir untuk role owner', () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      // Buka filter
      fireEvent.click(screen.getByLabelText('Filter Bulan & Periode'));

      expect(screen.getByText(/Maksimal 3 Bulan Terakhir/i)).toBeDefined();
      const select = screen.getByLabelText('Pilih Bulan');
      // Opsi: "Semua (3 Bulan Terakhir)" + 3 bulan
      expect(select.children).toHaveLength(4);
      expect(screen.getByText('Semua (3 Bulan Terakhir)')).toBeDefined();
    });

    it('menampilkan opsi hanya 1 bulan terakhir untuk role kasir', () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'kasir' }} />} />
          </Routes>
        </MemoryRouter>
      );

      // Buka filter
      fireEvent.click(screen.getByLabelText('Filter Bulan & Periode'));

      expect(screen.getByText(/Maksimal 1 Bulan Terakhir/i)).toBeDefined();
      const select = screen.getByLabelText('Pilih Bulan');
      // Opsi: "Semua (1 Bulan Terakhir)" + 1 bulan
      expect(select.children).toHaveLength(2);
      expect(screen.getByText('Semua (1 Bulan Terakhir)')).toBeDefined();
    });
  });

  describe('Enforcement Logika Query Database Dexie', () => {
    it('role kasir hanya boleh melihat data sebulan terakhir saja (order > 30 hari di-filter out)', async () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'kasir' }} />} />
          </Routes>
        </MemoryRouter>
      );

      expect(capturedQueryCallback).toBeTruthy();
      const filteredOrders = await capturedQueryCallback();

      // Kasir hanya boleh melihat order hari ini dan order 15 hari lalu (keduanya <= 30 hari)
      expect(filteredOrders).toHaveLength(2);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-TODAY')).toBe(true);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-15DAYS')).toBe(true);
      // Order 50 hari dan 120 hari lalu TIDAK boleh muncul untuk kasir
      expect(filteredOrders.some(o => o.invoiceId === 'INV-50DAYS')).toBe(false);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-120DAYS')).toBe(false);
    });

    it('role owner boleh melihat data 3 bulan terakhir, tapi order > 3 bulan di-filter out', async () => {
      render(
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      expect(capturedQueryCallback).toBeTruthy();
      const filteredOrders = await capturedQueryCallback();

      // Owner boleh melihat order hari ini, 15 hari lalu, dan 50 hari lalu (keduanya dalam 3 bulan terakhir)
      expect(filteredOrders).toHaveLength(3);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-TODAY')).toBe(true);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-15DAYS')).toBe(true);
      expect(filteredOrders.some(o => o.invoiceId === 'INV-50DAYS')).toBe(true);
      // Order 120 hari lalu (> 3 bulan) TIDAK boleh muncul untuk owner
      expect(filteredOrders.some(o => o.invoiceId === 'INV-120DAYS')).toBe(false);
    });

    it('saat mode hari ini (today=true), hanya order hari ini yang dikembalikan', async () => {
      render(
        <MemoryRouter initialEntries={['/reports?today=true']}>
          <Routes>
            <Route path="/reports" element={<Reports user={{ role: 'owner' }} />} />
          </Routes>
        </MemoryRouter>
      );

      expect(capturedQueryCallback).toBeTruthy();
      const filteredOrders = await capturedQueryCallback();

      expect(filteredOrders).toHaveLength(1);
      expect(filteredOrders[0].invoiceId).toBe('INV-TODAY');
    });
  });
});
