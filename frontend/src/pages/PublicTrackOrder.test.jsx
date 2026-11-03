import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicTrackOrder from './PublicTrackOrder';
import * as trackingUtils from '../utils/tracking';

describe('PublicTrackOrder Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('menampilkan rincian status pengerjaan, pembayaran, dan item order saat berhasil dimuat', async () => {
    const mockOrder = {
      id: 'ord-123',
      invoiceId: 'KL-00055',
      shortCode: 'S0wtMDAwNTU',
      status: 'Proses',
      statusBayar: 'Lunas',
      metodeBayar: 'Tunai',
      total: 45000,
      diskon: 0,
      estimasi: '2',
      tipeLayanan: 'Kiloan',
      createdAt: '2026-11-01T08:00:00Z',
      items: [
        { id: '1', name: 'Cuci Komplit Kiloan', quantity: 4.5, price: 10000, subtotal: 45000 },
      ],
      pelanggan: {
        nama: 'Ahmad Dahlan',
        hp: '0812****890',
      },
      store: {
        name: 'Laundry Wangi Express',
        phone: '08123456789',
        address: 'Jl. Merdeka No. 1',
      },
    };

    vi.spyOn(trackingUtils, 'fetchPublicOrder').mockResolvedValue({
      order: mockOrder,
      isOffline: false,
      source: 'server',
    });

    render(
      <MemoryRouter initialEntries={['/c/S0wtMDAwNTU']}>
        <Routes>
          <Route path="/c/:code" element={<PublicTrackOrder />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('#KL-00055')).not.toBeNull();
      expect(screen.getByText('Ahmad Dahlan')).not.toBeNull();
      expect(screen.getByText(/Cuci Komplit Kiloan/i)).not.toBeNull();
      expect(screen.getAllByText(/45\.000/).length).toBeGreaterThan(0);
      expect(screen.getByText('Siap Diambil')).not.toBeNull();
      expect(screen.getByText(/Tanya Kasir via WhatsApp/i)).not.toBeNull();
    });
  });

  it('menampilkan banner mode offline jika data bersumber dari cache offline', async () => {
    const mockOrder = {
      id: 'ord-offline-1',
      invoiceId: 'KL-00077',
      status: 'Selesai',
      statusBayar: 'Belum Lunas',
      total: 20000,
      items: [],
      pelanggan: { nama: 'Budi' },
      store: { name: 'Laundry Offline' },
    };

    vi.spyOn(trackingUtils, 'fetchPublicOrder').mockResolvedValue({
      order: mockOrder,
      isOffline: true,
      source: 'dexie-offline',
    });

    render(
      <MemoryRouter initialEntries={['/c/KL-00077']}>
        <Routes>
          <Route path="/c/:code" element={<PublicTrackOrder />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Mode Offline:/i)).not.toBeNull();
      expect(screen.getByText('#KL-00077')).not.toBeNull();
    });
  });

  it('tidak menampilkan spinner jika status order sudah diambil (step terakhir)', async () => {
    const mockOrder = {
      id: 'ord-diambil-1',
      invoiceId: 'KL-00099',
      status: 'Diambil',
      statusBayar: 'Lunas',
      total: 35000,
      items: [],
      pelanggan: { nama: 'Citra' },
      store: { name: 'Laundry Bersih' },
    };

    vi.spyOn(trackingUtils, 'fetchPublicOrder').mockResolvedValue({
      order: mockOrder,
      isOffline: false,
      source: 'server',
    });

    render(
      <MemoryRouter initialEntries={['/c/KL-00099']}>
        <Routes>
          <Route path="/c/:code" element={<PublicTrackOrder />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('#KL-00099')).not.toBeNull();
      expect(screen.getByText('Sudah Diambil')).not.toBeNull();
      // Spinner status tidak boleh ada saat status Diambil
      expect(document.querySelector('.spinner-grow')).toBeNull();
    });
  });

  it('menampilkan pesan error jika nomor nota tidak ditemukan', async () => {
    vi.spyOn(trackingUtils, 'fetchPublicOrder').mockRejectedValue(
      new Error('Pesanan dengan kode "INVALID" tidak ditemukan.')
    );

    render(
      <MemoryRouter initialEntries={['/c/INVALID']}>
        <Routes>
          <Route path="/c/:code" element={<PublicTrackOrder />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pesanan Tidak Ditemukan/i)).not.toBeNull();
      expect(screen.getByText(/Pesanan dengan kode "INVALID" tidak ditemukan/i)).not.toBeNull();
    });
  });

  it('menampilkan tampilan awal kosong jika halaman dibuka tanpa parameter kode', async () => {
    render(
      <MemoryRouter initialEntries={['/c/']}>
        <Routes>
          <Route path="/c/" element={<PublicTrackOrder />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Status Cucian Anda/i)).not.toBeNull();
  });
});
