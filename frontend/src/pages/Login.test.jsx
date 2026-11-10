import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as pwaHelper from '../utils/pwaHelper';

vi.mock('../db', () => ({
  db: {
    settings: {
      get: vi.fn().mockResolvedValue(null),
    },
  },
}));

describe('Login Page Store Branding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    window.matchMedia = window.matchMedia || vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  it('menampilkan "KASIR LAUNDRY" secara default saat belum ada kode toko', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login onLogin={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText('KASIR LAUNDRY')).not.toBeNull();
  });

  it('memuat dan menampilkan nama store dari API auth/store-info?code=STORE02 dari query params URL', async () => {
    vi.spyOn(pwaHelper, 'fetchStoreInfoByCode').mockResolvedValue({
      code: 'STORE02',
      name: 'Otto Laundry',
      address: 'Jl. Pemuda No. 5',
    });

    render(
      <MemoryRouter initialEntries={['/login?code=STORE02']}>
        <Login onLogin={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('OTTO LAUNDRY')).not.toBeNull();
      expect(screen.getByText('Sistem Manajemen & Kasir - Otto Laundry')).not.toBeNull();
    }, { timeout: 2000 });
  });

  it('memperbarui nama store secara dinamis saat user mengetik kode toko STORE02', async () => {
    vi.spyOn(pwaHelper, 'fetchStoreInfoByCode').mockImplementation(async (code) => {
      if (code === 'STORE02') {
        return {
          code: 'STORE02',
          name: 'Otto Laundry',
          address: 'Jl. Pemuda No. 5',
        };
      }
      return null;
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Login onLogin={vi.fn()} />
      </MemoryRouter>
    );

    const storeInput = screen.getByPlaceholderText(/Masukan Kode/i);
    fireEvent.change(storeInput, { target: { value: 'STORE02' } });

    await waitFor(() => {
      expect(screen.getByText('OTTO LAUNDRY')).not.toBeNull();
    }, { timeout: 2000 });
  });
});
