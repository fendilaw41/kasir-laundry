import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Setting from './Setting';

// Mock Dexie useLiveQuery
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

// Mock repositories
vi.mock('../db/repositories/settings', () => ({
  getSettingsQuery: () => 'SETTINGS_QUERY',
  updateSettings: vi.fn().mockResolvedValue(true),
}));

vi.mock('../db/repositories/users', () => ({
  getKasirUsersQuery: () => 'USERS_QUERY',
  addUser: vi.fn().mockResolvedValue(1),
  updateUser: vi.fn().mockResolvedValue(1),
  deleteUser: vi.fn().mockResolvedValue(1),
}));

vi.mock('../db/repositories/products', () => ({
  getProductsQuery: () => 'PRODUCTS_QUERY',
  addProduct: vi.fn().mockResolvedValue(1),
  updateProduct: vi.fn().mockResolvedValue(1),
  deleteProduct: vi.fn().mockResolvedValue(1),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useLiveQuery } from 'dexie-react-hooks';

describe('Setting Component - Mobile Redesign', () => {
  const mockSettings = {
    id: 1,
    namaLaundry: 'Laundry Bersih',
    motto: 'Bersih Cepat Rapi',
    alamat: 'Jl. Ahmad Yani No. 45',
    kota: 'Karawang',
    telepon: '08123456789',
    jamBuka: '08:00 - 20:00',
    menerimaCucian: true,
    headerStruk: 'Terima Kasih Atas Kunjungan Anda',
    footerStruk: 'Barang tidak diambil > 30 hari di luar tanggung jawab kami',
  };

  const mockKasirUsers = [
    { id: 1, fullname: 'Siti Kasir', username: 'siti123', role: 'kasir' },
    { id: 2, fullname: 'Budi Kasir', username: 'budi123', role: 'kasir' },
  ];

  const mockProducts = [
    { id: 1, name: 'Cuci Lipat Reguler', category: 'CUCI LIPAT', code: 'CLR', price: 5000 },
    { id: 2, name: 'Cuci Setrika Express', category: 'CUCI SETRIKA', code: 'CSE', price: 9000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockQueries = (
    settingsData = mockSettings,
    usersData = mockKasirUsers,
    productsData = mockProducts
  ) => {
    useLiveQuery.mockImplementation((queryFn) => {
      const q = typeof queryFn === 'function' ? queryFn() : queryFn;
      if (q === 'USERS_QUERY') return usersData;
      if (q === 'PRODUCTS_QUERY') return productsData;
      return settingsData;
    });
  };

  const renderSetting = (props = { user: { role: 'owner' } }) => {
    return render(
      <MemoryRouter>
        <Setting {...props} />
      </MemoryRouter>
    );
  };

  it('menampilkan loading state jika data settings belum tersedia', () => {
    useLiveQuery.mockReturnValue(null);
    renderSetting({ user: { role: 'owner' } });
    expect(screen.getByText(/Memuat data pengaturan.../i)).toBeDefined();
  });

  it('merender menu Pengaturan Toko, Format Nota & Struk, dan Manajemen Kasir untuk akun owner', () => {
    setupMockQueries();

    renderSetting({ user: { role: 'owner' } });

    expect(screen.getByRole('button', { name: /Pengaturan Toko/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Format Nota & Struk/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Manajemen Kasir/i })).toBeDefined();
    expect(screen.getByText('Laundry Bersih')).toBeDefined();
  });

  it('menyembunyikan menu Manajemen Kasir jika user bukan owner', () => {
    setupMockQueries();

    renderSetting({ user: { role: 'kasir' } });

    expect(screen.getByRole('button', { name: /Pengaturan Toko/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Format Nota & Struk/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /Manajemen Kasir/i })).toBeNull();
  });

  it('dapat berpindah tab ke Struk dan menampilkan simulasi nota thermal', () => {
    setupMockQueries();

    renderSetting({ user: { role: 'owner' } });

    // Click menu Format Nota & Struk
    const strukMenu = screen.getByRole('button', { name: /Format Nota & Struk/i });
    fireEvent.click(strukMenu);

    expect(screen.getByText(/Simulasi Struk Thermal \(58mm\)/i)).toBeDefined();
    expect(screen.getByDisplayValue('Terima Kasih Atas Kunjungan Anda')).toBeDefined();
  });

  it('dapat berpindah tab ke Kasir dan menampilkan daftar kasir serta tombol tambah', () => {
    setupMockQueries();

    renderSetting({ user: { role: 'owner' } });

    // Click menu Manajemen Kasir
    const kasirMenu = screen.getByRole('button', { name: /Manajemen Kasir/i });
    fireEvent.click(kasirMenu);

    expect(screen.getByText(/Daftar Akun Kasir/i)).toBeDefined();
    expect(screen.getByText('Siti Kasir')).toBeDefined();
    expect(screen.getByText('Budi Kasir')).toBeDefined();
    expect(screen.getByRole('button', { name: /Tambah Kasir/i })).toBeDefined();
  });

  it('dapat berpindah tab ke Layanan dan menampilkan daftar produk serta tombol tambah untuk owner', () => {
    setupMockQueries();

    renderSetting({ user: { role: 'owner' } });

    // Click tab Layanan
    const productTab = screen.getByRole('button', { name: /Layanan/i });
    fireEvent.click(productTab);

    expect(screen.getAllByText(/^Layanan$/i)[0]).toBeDefined();
    expect(screen.getByText('Cuci Lipat Reguler')).toBeDefined();
    expect(screen.getByText('Cuci Setrika Express')).toBeDefined();
    expect(screen.getByRole('button', { name: /Tambah Layanan/i })).toBeDefined();
  });
});
