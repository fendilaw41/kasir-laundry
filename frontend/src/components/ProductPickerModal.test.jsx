import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductPickerModal from './ProductPickerModal';
import { addProductToCart } from '../db/repositories/cart';

const mockProducts = vi.fn();

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (queryFn) => queryFn(),
}));

vi.mock('../db/repositories/products', () => ({
  getProductsQuery: () => mockProducts(),
}));

vi.mock('../db/repositories/cart', () => ({
  addProductToCart: vi.fn().mockResolvedValue(true),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProductPickerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleProducts = [
    { id: 1, name: 'Cuci Kiloan Reguler', price: 7000, category: 'KILOAN', code: 'CK-01' },
    { id: 2, name: 'Setrika Reguler', price: 5000, category: 'SETRIKA', code: 'ST-01' },
    { id: 3, name: 'Bed Cover Sedang', price: 25000, category: 'BED COVER', code: 'BC-01' },
  ];

  it('tidak merender apapun ketika isOpen=false', () => {
    mockProducts.mockReturnValue(sampleProducts);
    const { container } = render(<ProductPickerModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('merender popup modal dengan daftar produk ketika isOpen=true', () => {
    mockProducts.mockReturnValue(sampleProducts);
    render(<ProductPickerModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Pilih Layanan / Produk')).toBeDefined();
    expect(screen.getByText('Cuci Kiloan Reguler')).toBeDefined();
    expect(screen.getByText('Setrika Reguler')).toBeDefined();
    expect(screen.getByText('Bed Cover Sedang')).toBeDefined();
  });

  it('dapat melakukan live search produk berdasarkan nama atau kode', () => {
    mockProducts.mockReturnValue(sampleProducts);
    render(<ProductPickerModal isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Cari nama layanan/i);
    fireEvent.change(searchInput, { target: { value: 'setrika' } });

    expect(screen.getByText('Setrika Reguler')).toBeDefined();
    expect(screen.queryByText('Cuci Kiloan Reguler')).toBeNull();
    expect(screen.queryByText('Bed Cover Sedang')).toBeNull();
  });

  it('dapat memfilter produk berdasarkan kategori chips', () => {
    mockProducts.mockReturnValue(sampleProducts);
    render(<ProductPickerModal isOpen={true} onClose={vi.fn()} />);

    const kiloanChip = screen.getByRole('button', { name: 'KILOAN' });
    fireEvent.click(kiloanChip);

    expect(screen.getByText('Cuci Kiloan Reguler')).toBeDefined();
    expect(screen.queryByText('Setrika Reguler')).toBeNull();
    expect(screen.queryByText('Bed Cover Sedang')).toBeNull();
  });

  it('dapat menambah kuantitas dan memasukkan produk ke cart saat tombol Pilih diklik', async () => {
    mockProducts.mockReturnValue(sampleProducts);
    render(<ProductPickerModal isOpen={true} onClose={vi.fn()} />);

    const plusButtons = screen.getAllByLabelText('Tambah');
    fireEvent.click(plusButtons[0]); // qty bertambah menjadi 2

    const pilihButtons = screen.getAllByRole('button', { name: /Pilih/i });
    fireEvent.click(pilihButtons[0]);

    await waitFor(() => {
      expect(addProductToCart).toHaveBeenCalledWith(sampleProducts[0], 2);
    });
  });

  it('memanggil onClose saat tombol close atau tombol Selesai diklik', () => {
    const handleClose = vi.fn();
    mockProducts.mockReturnValue(sampleProducts);
    render(<ProductPickerModal isOpen={true} onClose={handleClose} />);

    const selesaiBtn = screen.getByRole('button', { name: /Selesai/i });
    fireEvent.click(selesaiBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('merender container dengan overflow-y auto dan maxHeight agar bisa di-scroll ketika produk banyak', () => {
    const manyProducts = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      name: `Layanan Ke-${i + 1}`,
      price: 10000 + i * 1000,
      category: 'CUCI',
      code: `C-${i + 1}`,
    }));
    mockProducts.mockReturnValue(manyProducts);
    const { container } = render(<ProductPickerModal isOpen={true} onClose={vi.fn()} />);

    const scrollContainer = container.querySelector('.custom-scroll');
    expect(scrollContainer).toBeDefined();
    expect(scrollContainer.className).toContain('overflow-y-auto');
    expect(scrollContainer.style.overflowY).toBe('auto');
    expect(scrollContainer.style.maxHeight).toBe('calc(88vh - 170px)');
  });
});

