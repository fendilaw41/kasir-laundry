import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Transaksi from './Transaksi';
import { createOrderFromCheckout } from '../db/repositories/orders';
import { playSuccessChime } from '../utils/soundHelper';

// Mock dependencies
const mockCartItems = vi.fn();
const mockDaftarPelanggan = vi.fn();
const mockInventory = vi.fn();
const mockDraftOrder = vi.fn();

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn) => {
    return queryFn();
  },
}));

vi.mock('../db/repositories/cart', () => ({
  getCartQuery: () => mockCartItems(),
  removeProductFromCart: vi.fn(),
  updateCartItemQty: vi.fn(),
  clearCart: vi.fn(),
}));

vi.mock('../db/repositories/pelanggan', () => ({
  getPelangganQuery: () => mockDaftarPelanggan(),
  addPelanggan: vi.fn(),
}));

vi.mock('../db/repositories/inventory', () => ({
  getInventoryQuery: () => mockInventory(),
}));

vi.mock('../db/repositories/products', () => ({
  getProductsQuery: () => [],
}));

vi.mock('../db/repositories/draftOrder', () => ({
  getDraftOrderQuery: () => mockDraftOrder(),
  updateDraftOrder: vi.fn(),
  clearDraftOrder: vi.fn(),
}));

vi.mock('../db/repositories/orders', () => ({
  createOrderFromCheckout: vi.fn().mockResolvedValue(101),
  getOrderByIdQuery: vi.fn().mockResolvedValue({ id: 101, invoiceId: 'INV-101' }),
}));

vi.mock('../utils/soundHelper', () => ({
  playSuccessChime: vi.fn(),
}));

vi.mock('../utils/authSession', () => ({
  validateAuthSession: vi.fn().mockReturnValue(true),
  getStoredUser: vi.fn().mockReturnValue({ id: 'u1', uuid: 'u1-uuid', username: 'kasir1' }),
}));

vi.mock('../services/subscriptionService', () => ({
  getSubscriptionReport: vi.fn().mockResolvedValue({ isEnforced: false }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Transaksi Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDaftarPelanggan.mockReturnValue([{ id: 1, nama: 'Budi', hp: '08123456789' }]);
    mockInventory.mockReturnValue([]);
    mockDraftOrder.mockReturnValue({ pelanggan: { id: 1, nama: 'Budi' }, inventory: [] });
  });

  it('mengisi otomatis estimasi menjadi 3 hari jika ada 10 item cuci Reguler (2-3 hari)', () => {
    const tenItems = Array.from({ length: 10 }).map((_, i) => ({
      id: i + 1,
      name: 'CUCI LIPAT - Reguler (2-3 hari)',
      price: 5000,
      quantity: 1,
    }));
    mockCartItems.mockReturnValue(tenItems);

    render(<Transaksi />);

    const estimasiInput = screen.getByLabelText(/Estimasi/i);
    expect(estimasiInput).toBeDefined();
    // Harus bernilai 3 otomatis (nilai terlama dari 2-3 hari)
    expect(estimasiInput.value).toBe('3');
  });

  it('mengisi otomatis estimasi nilai terlama jika terdapat campuran layanan (Express 1 Hari dan Bed Cover 3-4 hari)', () => {
    const mixedItems = [
      { id: 1, name: 'CUCI LIPAT - Express (1 Hari)', price: 7000, quantity: 2 },
      { id: 2, name: 'BED COVER - Reguler (3-4 hari)', price: 25000, quantity: 1 },
    ];
    mockCartItems.mockReturnValue(mixedItems);

    render(<Transaksi />);

    const estimasiInput = screen.getByLabelText(/Estimasi/i);
    // max(1, 4) = 4 hari
    expect(estimasiInput.value).toBe('4');
  });

  it('memungkinkan kasir untuk mengubah nilai estimasi hari secara manual', () => {
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI LIPAT - Reguler (2-3 hari)', price: 5000, quantity: 1 },
    ]);

    render(<Transaksi />);

    const estimasiInput = screen.getByLabelText(/Estimasi/i);
    expect(estimasiInput.value).toBe('3');

    // Kasir mengubah ke 5 hari
    fireEvent.change(estimasiInput, { target: { value: '5' } });
    expect(estimasiInput.value).toBe('5');
  });

  it('menampilkan "Pelanggan Umum" secara otomatis jika draft tidak memiliki pelanggan terpilih', () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI KILOAN', price: 10000, quantity: 1 },
    ]);

    render(<Transaksi />);

    expect(screen.getAllByText('Pelanggan Umum').length).toBeGreaterThan(0);
  });

  it('floating drawer pembayaran aktif secara default dan menyediakan tombol nominal cepat (Uang Pas, 20rb, 50rb, 100rb)', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 25000, quantity: 1 },
    ]);

    render(<Transaksi />);

    // Drawer aktif secara default (Docked Bottom)
    expect(screen.getByText('Pembayaran Kasir')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Uang Pas' })).toBeDefined();
    expect(screen.getByRole('button', { name: '20rb' })).toBeDefined();
    expect(screen.getByRole('button', { name: '50rb' })).toBeDefined();
    expect(screen.getByRole('button', { name: '100rb' })).toBeDefined();

    // Klik tombol 50rb
    const btn50rb = screen.getByRole('button', { name: '50rb' });
    fireEvent.click(btn50rb);

    const nominalInput = screen.getByLabelText(/Nominal Uang Diterima/i);
    expect(nominalInput.value).toBe('50000');
  });

  it('jika nominal tidak diisi, pembayaran otomatis lunas sesuai tagihan dan memutar suara sukses', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 20000, quantity: 1 },
    ]);

    render(<Transaksi />);

    expect(screen.getByText('Pembayaran Kasir')).toBeDefined();

    // Nominal dibiarkan kosong, langsung klik tombol Bayar dari floating dock
    const submitBtn = screen.getByRole('button', { name: /^Bayar$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createOrderFromCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          bayarNum: 20000,
          kembalian: 0,
          isLunas: true,
          orderData: expect.objectContaining({
            pelangganNama: 'Pelanggan Umum',
            total: 20000,
          }),
        })
      );
      expect(playSuccessChime).toHaveBeenCalled();
      expect(screen.getByText('Transaksi Berhasil!')).toBeDefined();
    });
  });

  it('drawer pembayaran secara default dalam mode ringkas (compact) dan dapat di-toggle perbesar / perkecil serta ditutup', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 20000, quantity: 1 },
    ]);

    render(<Transaksi />);

    expect(screen.getByText('Pembayaran Kasir')).toBeDefined();

    // Default: Tombol perbesar (bi-arrows-angle-expand) tersedia
    const toggleBtn = screen.getByTitle('Perbesar tampilan drawer');
    expect(toggleBtn).toBeDefined();

    // Klik tombol perbesar -> berubah menjadi tombol perkecil
    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('Perkecil tampilan drawer')).toBeDefined();

    // Klik tombol perkecil -> kembali ke mode ringkas
    const contractBtn = screen.getByTitle('Perkecil tampilan drawer');
    fireEvent.click(contractBtn);
    expect(screen.getByTitle('Perbesar tampilan drawer')).toBeDefined();

    // Test tombol close drawer
    const closeBtn = screen.getByTitle('Tutup Pembayaran');
    fireEvent.click(closeBtn);
    expect(screen.getByRole('button', { name: /^Bayar$/i })).toBeDefined();
  });

  it('mengklik tombol "New" pada daftar layanan membuka modal popup pemilihan produk/layanan', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 20000, quantity: 1 },
    ]);

    render(<Transaksi />);

    // Tombol 'New' pada header Layanan Dipilih
    const newBtn = screen.getByRole('button', { name: /New/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText('Pilih Layanan / Produk')).toBeDefined();
    });
  });
});
