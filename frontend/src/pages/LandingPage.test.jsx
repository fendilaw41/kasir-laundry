import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

describe('LandingPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('merender nama brand TokoPlus, judul headline, dan tombol CTA utama ke halaman login dan register', () => {
    render(
      <MemoryRouter>
        <LandingPage user={null} />
      </MemoryRouter>
    );

    // Memeriksa nama brand TokoPlus
    expect(screen.getAllByText(/TokoPlus/i).length).toBeGreaterThan(0);

    // Memeriksa headline
    expect(screen.getByText(/Kelola Usaha Laundry Jadi Lebih/i)).not.toBeNull();
    expect(screen.getByText(/Anti-Ribet/i)).not.toBeNull();

    // Memeriksa tombol Masuk mengarah ke /login
    const loginLinks = screen.getAllByRole('link', { name: /Masuk Akun Kasir|Masuk/i });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks.some((l) => l.getAttribute('href') === '/login')).toBe(true);

    // Memeriksa tombol Coba Gratis tersedia
    const ctaLinks = screen.getAllByRole('link', { name: /Coba Gratis/i });
    expect(ctaLinks.length).toBeGreaterThan(0);
  });

  it('merender fitur-fitur kasir laundry (Kiloan, WhatsApp, Bluetooth Thermal, Offline, dll)', () => {
    render(
      <MemoryRouter>
        <LandingPage user={null} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Kasir Kiloan & Satuan Kilat/i)).not.toBeNull();
    expect(screen.getByText(/Kirim Nota Otomatis ke WhatsApp/i)).not.toBeNull();
    expect(screen.getByRole('heading', { name: /Cetak Struk Thermal Bluetooth/i })).not.toBeNull();
    expect(screen.getByText(/Tracking Status Pesanan Publik/i)).not.toBeNull();
    expect(screen.getByText(/Inventori & Kontrol Stok/i)).not.toBeNull();
    expect(screen.getByText(/Offline-First Tanpa Khawatir/i)).not.toBeNull();
  });

  it('merender daftar pertanyaan FAQ dan bisa berinteraksi', () => {
    render(
      <MemoryRouter>
        <LandingPage user={null} />
      </MemoryRouter>
    );

    const faqButton = screen.getByRole('button', { name: /Apakah bisa digunakan di laptop\/PC dan HP sekaligus\?/i });
    expect(faqButton).not.toBeNull();
    expect(faqButton.getAttribute('aria-expanded')).toBe('true');

    // Klik untuk menutup
    fireEvent.click(faqButton);
    expect(faqButton.getAttribute('aria-expanded')).toBe('false');

    // Klik lagi untuk membuka
    fireEvent.click(faqButton);
    expect(faqButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('menampilkan tombol Dashboard jika user sudah dalam keadaan login', () => {
    render(
      <MemoryRouter>
        <LandingPage user={{ username: 'owner', role: 'owner' }} />
      </MemoryRouter>
    );

    const dashboardEl = screen.getByText(/Masuk ke Dashboard/i);
    expect(dashboardEl).not.toBeNull();
    const linkEl = dashboardEl.closest('a');
    expect(linkEl).not.toBeNull();
    expect(linkEl.getAttribute('href')).toBe('/');
  });
});
