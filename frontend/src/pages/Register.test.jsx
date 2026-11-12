import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';

// Mock registerUser repository
vi.mock('../db/repositories/users', () => ({
  registerUser: vi.fn(),
}));

// Mock pwaHelper
vi.mock('../utils/pwaHelper', () => ({
  fetchStoreInfoByCode: vi.fn().mockResolvedValue(null),
}));

describe('Register Page Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('merender form pendaftaran akun Owner TokoPlus secara default', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    // Memeriksa header branding
    expect(screen.getByText('TOKOPLUS')).toBeDefined();
    expect(screen.getByText('Daftar Akun Owner')).toBeDefined();

    // Memeriksa form input dasar
    expect(screen.getByPlaceholderText(/Contoh: Berkah Laundry/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/81234567890/i)).toBeDefined();
    expect(screen.getByPlaceholderText('Contoh: John Pratama')).toBeDefined();
    expect(screen.getByPlaceholderText('Contoh: john')).toBeDefined();
    expect(screen.getByPlaceholderText(/Minimal 6 karakter/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/Ulangi password/i)).toBeDefined();

    // Memeriksa tombol submit dan link login
    expect(screen.getByRole('button', { name: /^Daftar$/i })).toBeDefined();
    expect(screen.getByRole('link', { name: /Login di sini/i })).toBeDefined();
  });

  it('menampilkan indikator keamanan password saat password diketik', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const passInput = screen.getByPlaceholderText(/Minimal 6 karakter/i);
    fireEvent.change(passInput, { target: { value: 'Secret123!' } });

    expect(screen.getByText('Ketentuan Keamanan Password:')).toBeDefined();
    expect(screen.getByText(/Min 6 karakter/i)).toBeDefined();
    expect(screen.getByText(/Huruf besar & kecil/i)).toBeDefined();
    expect(screen.getByText(/Karakter spesial/i)).toBeDefined();
  });
});
