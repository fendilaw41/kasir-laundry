import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Transaksi from './Transaksi';
import { createOrderFromCheckout } from '../db/repositories/orders';
import { addProductToCart } from '../db/repositories/cart';
import { playSuccessChime } from '../utils/soundHelper';

// Mock dependencies
const mockCartItems = vi.fn();
const mockDaftarPelanggan = vi.fn();
const mockInventory = vi.fn();
const mockDraftOrder = vi.fn();
const mockProducts = vi.fn();

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn) => {
    return queryFn();
  },
}));

vi.mock('../db/repositories/cart', () => ({
  getCartQuery: () => mockCartItems(),
  addProductToCart: vi.fn(),
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
  getProductsQuery: () => mockProducts(),
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
    mockProducts.mockReturnValue([]);
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
    expect(estimasiInput.value).toBe('4');
  });

  it('memungkinkan kasir untuk mengubah nilai estimasi hari secara manual', () => {
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI LIPAT - Reguler (2-3 hari)', price: 5000, quantity: 1 },
    ]);

    render(<Transaksi />);

    const estimasiInput = screen.getByLabelText(/Estimasi/i);
    expect(estimasiInput.value).toBe('3');

    fireEvent.change(estimasiInput, { target: { value: '5' } });
    expect(estimasiInput.value).toBe('5');
  });

  it('menampilkan "Pelanggan Umum" secara otomatis jika draft tidak memiliki pelanggan terpilih', () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI KILOAN', price: 10000, quantity: 1 },
    ]);

    render(<Transaksi />);

    // Buka modal pelanggan dengan tombol person-plus
    const personBtn = screen.getByTitle('Pilih / Tambah Pelanggan');
    fireEvent.click(personBtn);

    expect(screen.getAllByText('Pelanggan Umum').length).toBeGreaterThan(0);
  });

  it('floating drawer pembayaran aktif secara default dan menyediakan tombol nominal cepat (Uang Pas, 20rb, 50rb, 100rb)', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 25000, quantity: 1 },
    ]);

    render(<Transaksi />);

    expect(screen.getByText('TOTAL TAGIHAN')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Uang Pas' })).toBeDefined();
    expect(screen.getByRole('button', { name: '20rb' })).toBeDefined();
    expect(screen.getByRole('button', { name: '50rb' })).toBeDefined();
    expect(screen.getByRole('button', { name: '100rb' })).toBeDefined();

    const btn50rb = screen.getByRole('button', { name: '50rb' });
    fireEvent.click(btn50rb);

    // Input nominal terisi otomatis, kembalian terhitung, dan tombol bayar memuat nominal
    const nominalInput = screen.getByLabelText(/Nominal Uang Diterima/i);
    expect(nominalInput.value).toBe('50000');
    expect(screen.getAllByText('Rp 25.000').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Bayar • Rp 25\.000/i })).toBeDefined();
  });

  it('jika nominal tidak diisi, pembayaran otomatis lunas sesuai tagihan dan memutar suara sukses', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 20000, quantity: 1 },
    ]);

    render(<Transaksi />);

    expect(screen.getByText('TOTAL TAGIHAN')).toBeDefined();

    const submitBtn = screen.getByRole('button', { name: /^Bayar •/i });
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

    expect(screen.getByText('TOTAL TAGIHAN')).toBeDefined();

    const toggleBtn = screen.getByTitle('Perbesar tampilan drawer');
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.getByTitle('Perkecil tampilan drawer')).toBeDefined();

    const contractBtn = screen.getByTitle('Perkecil tampilan drawer');
    fireEvent.click(contractBtn);
    expect(screen.getByTitle('Perbesar tampilan drawer')).toBeDefined();

    // Tombol close menutup drawer pembayaran
    const closeBtn = screen.getByTitle('Tutup Pembayaran');
    fireEvent.click(closeBtn);
    expect(screen.queryByText('TOTAL TAGIHAN')).toBeNull();
  });

  it('menampilkan card layanan langsung di halaman transaksi dan mengetuk card menambahkan produk ke keranjang', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([]);
    mockProducts.mockReturnValue([
      { id: 1, name: 'Kilat (4 Jam)', category: 'CUCI SETRIKA', price: 14000, code: 'CSK' },
      { id: 2, name: 'Kilat (4 Jam)', category: 'SETRIKA SAJA', price: 12000, code: 'SSK' },
    ]);

    render(<Transaksi />);

    // Header Layanan dan kartu layanan langsung tampil tanpa modal
    expect(screen.getByText('Layanan')).toBeDefined();
    expect(screen.getByText('Ketuk kartu untuk memilih jenis cuci/setrika')).toBeDefined();
    expect(screen.getByText('CSK')).toBeDefined();
    expect(screen.getByText('SSK')).toBeDefined();

    // Klik kartu Kilat 14.000 untuk menambah ke keranjang
    const serviceName = screen.getAllByText(/Kilat/i)[0];
    fireEvent.click(serviceName);

    expect(addProductToCart).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Kilat (4 Jam)', price: 14000 }),
      1
    );
  });

  it('card badge diskon membuka modal popup untuk mengatur diskon persentase atau rupiah', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([
      { id: 1, name: 'CUCI SETRIKA', price: 50000, quantity: 1 },
    ]);

    render(<Transaksi />);

    // Klik card badge Diskon
    const diskonBadge = screen.getByText('Diskon');
    fireEvent.click(diskonBadge);

    // Modal popup diskon muncul
    expect(screen.getByText('Pengaturan Diskon')).toBeDefined();
    expect(screen.getByText('Persentase (%)')).toBeDefined();
    expect(screen.getByText('Nominal (Rp)')).toBeDefined();
    expect(screen.getByText('Terapkan')).toBeDefined();
  });

  it('card badge delivery dan prioritas menggunakan select pilihan dan dapat diubah', async () => {
    mockDraftOrder.mockReturnValue({ pelanggan: null, inventory: [] });
    mockCartItems.mockReturnValue([]);

    render(<Transaksi />);

    // Delivery select
    const deliverySelect = screen.getByLabelText('Delivery');
    expect(deliverySelect.value).toBe('Datang Langsung');
    fireEvent.change(deliverySelect, { target: { value: 'Jemput/Antar' } });
    expect(deliverySelect.value).toBe('Jemput/Antar');

    // Prioritas select
    const prioritasSelect = screen.getByLabelText('Prioritas');
    expect(prioritasSelect.value).toBe('Tidak');
    fireEvent.change(prioritasSelect, { target: { value: 'Ya' } });
    expect(prioritasSelect.value).toBe('Ya');
  });
});
