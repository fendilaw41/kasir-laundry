import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

describe('LandingPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('merender nama brand TokoPlus, judul headline, dan tombol CTA utama ke halaman login', () => {
    render(
      <MemoryRouter>
        <LandingPage user={null} />
      </MemoryRouter>
    );

    // Memeriksa nama brand TokoPlus
    expect(screen.getAllByText(/TokoPlus/i).length).toBeGreaterThan(0);

    // Memeriksa headline
    expect(screen.getByText(/Kelola Usaha Laundry Jadi Lebih/i)).not.toBeNull();
    expect(screen.getByText(/Cepat & Rapi/i)).not.toBeNull();

    // Memeriksa tombol CTA mengarah ke /login
    const ctaButtons = screen.getAllByRole('link', { name: /Mulai Coba Gratis|Coba Gratis 30 Hari|Masuk|Masuk Akun Kasir/i });
    expect(ctaButtons.length).toBeGreaterThan(0);
    ctaButtons.forEach((link) => {
      expect(link.getAttribute('href')).toBe('/login');
    });
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

  it('bisa membuka dan menutup FAQ pertanyaan saat diklik', () => {
    render(
      <MemoryRouter>
        <LandingPage user={null} />
      </MemoryRouter>
    );

    const faqButton = screen.getByText(/Apakah TokoPlus bisa digunakan di laptop\/PC dan HP sekaligus\?/i);
    expect(faqButton).not.toBeNull();

    // Awalnya jawaban tersembunyi
    expect(screen.queryByText(/TokoPlus dapat diakses bersamaan melalui browser laptop/i)).toBeNull();

    // Klik untuk membuka
    fireEvent.click(faqButton);
    expect(screen.getByText(/TokoPlus dapat diakses bersamaan melalui browser laptop/i)).not.toBeNull();

    // Klik lagi untuk menutup
    fireEvent.click(faqButton);
    expect(screen.queryByText(/TokoPlus dapat diakses bersamaan melalui browser laptop/i)).toBeNull();
  });

  it('menampilkan tombol "Buka Dashboard" jika user sudah dalam keadaan login', () => {
    render(
      <MemoryRouter>
        <LandingPage user={{ username: 'owner', role: 'owner' }} />
      </MemoryRouter>
    );

    const dashboardLink = screen.getByRole('link', { name: /Buka Dashboard/i });
    expect(dashboardLink).not.toBeNull();
    expect(dashboardLink.getAttribute('href')).toBe('/');
  });
});
