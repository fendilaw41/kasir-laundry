import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Product from './Product';

// Mock dependencies
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../db/repositories/products', () => ({
  getProductsQuery: vi.fn(),
}));

vi.mock('../db/repositories/cart', () => ({
  addProductToCart: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { useLiveQuery } from 'dexie-react-hooks';

describe('Product Page Category Dropdown', () => {
  it('renders up to 2 initial categories without dropdown when <= 2 categories exist', () => {
    useLiveQuery.mockReturnValue([
      { id: 1, name: 'Baju', category: 'CUCI LIPAT', price: 5000 },
      { id: 2, name: 'Celana', category: 'CUCI SETRIKA', price: 7000 },
    ]);

    render(<Product />);

    expect(screen.getByRole('button', { name: 'Semua' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'CUCI LIPAT' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'CUCI SETRIKA' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /\+\d+/ })).toBeNull();
  });

  it('renders 2 initial categories and +N dropdown button when more than 2 categories exist', () => {
    useLiveQuery.mockReturnValue([
      { id: 1, name: 'Baju', category: 'CUCI LIPAT', price: 5000 },
      { id: 2, name: 'Celana', category: 'CUCI SETRIKA', price: 7000 },
      { id: 3, name: 'Jas', category: 'SETRIKA SAJA', price: 10000 },
    ]);

    render(<Product />);

    expect(screen.getByRole('button', { name: 'Semua' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'CUCI LIPAT' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'CUCI SETRIKA' })).toBeDefined();

    // categories are 3 -> first 2 are displayed as buttons, other 1 (SETRIKA SAJA) in dropdown
    const dropdownButton = screen.getByRole('button', { name: /\+1/ });
    expect(dropdownButton).toBeDefined();

    // Dropdown menu initially hidden
    expect(screen.queryByRole('button', { name: 'SETRIKA SAJA' })).toBeNull();

    // Click +1 dropdown button
    fireEvent.click(dropdownButton);

    // Dropdown item now visible as button in dropdown
    const itemButton = screen.getByRole('button', { name: 'SETRIKA SAJA' });
    expect(itemButton).toBeDefined();

    // Click the item
    fireEvent.click(itemButton);

    // Dropdown closes and button shows active blue state
    expect(dropdownButton.textContent).toContain('+1');
    expect(dropdownButton.style.backgroundColor).toBe('rgb(13, 90, 253)');
  });
});
