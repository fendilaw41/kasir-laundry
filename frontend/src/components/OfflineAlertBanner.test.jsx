import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineAlertBanner from './OfflineAlertBanner';
import * as offlineGuard from '../utils/offlineGuard';

describe('OfflineAlertBanner Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tidak menampilkan banner jika perangkat online atau belum 3 hari offline', () => {
    vi.spyOn(offlineGuard, 'isOfflineExceeded3Days').mockReturnValue(false);

    const { container } = render(<OfflineAlertBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('menampilkan banner peringatan jika perangkat sudah offline lebih dari 3 hari', () => {
    vi.spyOn(offlineGuard, 'isOfflineExceeded3Days').mockReturnValue(true);

    render(<OfflineAlertBanner />);

    expect(
      screen.getByText(/Sudah 3 hari offline! Sambung internet yuk/i),
    ).not.toBeNull();
    expect(screen.getByText('Cek Koneksi')).not.toBeNull();
  });
});

