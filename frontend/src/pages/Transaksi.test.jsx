import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Transaksi from './Transaksi';

// Mock dependencies
const mockCartItems = vi.fn();
const mockDaftarPelanggan = vi.fn();
const mockInventory = vi.fn();
const mockDraftOrder = vi.fn();

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn) => {
    // Return value depending on query
    return queryFn();
  },
}));

vi.mock('../db/repositories/cart', () => ({
  getCartQuery: () => mockCartItems(),
  removeProductFromCart: vi.fn(),
  updateCartItemQty: vi.fn(),
}));

vi.mock('../db/repositories/pelanggan', () => ({
  getPelangganQuery: () => mockDaftarPelanggan(),
  addPelanggan: vi.fn(),
}));

vi.mock('../db/repositories/inventory', () => ({
  getInventoryQuery: () => mockInventory(),
}));

vi.mock('../db/repositories/draftOrder', () => ({
  getDraftOrderQuery: () => mockDraftOrder(),
  updateDraftOrder: vi.fn(),
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

describe('Transaksi Page - Auto Calculation Estimasi', () => {
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
});
