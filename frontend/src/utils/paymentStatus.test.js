import { describe, it, expect } from 'vitest';
import { getStatusLunasByMetode, isStatusLunas } from './paymentStatus';

describe('paymentStatus utility', () => {
  describe('getStatusLunasByMetode', () => {
    it('mengubah metode QRIS menjadi Lunas QRIS', () => {
      expect(getStatusLunasByMetode('QRIS')).toBe('Lunas QRIS');
      expect(getStatusLunasByMetode('qris')).toBe('Lunas QRIS');
    });

    it('mengubah metode Deposit menjadi Lunas Deposit', () => {
      expect(getStatusLunasByMetode('Deposit')).toBe('Lunas Deposit');
      expect(getStatusLunasByMetode('deposit')).toBe('Lunas Deposit');
    });

    it('mengubah metode Cash atau Tunai menjadi Lunas Cash', () => {
      expect(getStatusLunasByMetode('Cash')).toBe('Lunas Cash');
      expect(getStatusLunasByMetode('cash')).toBe('Lunas Cash');
      expect(getStatusLunasByMetode('Tunai')).toBe('Lunas Cash');
      expect(getStatusLunasByMetode('tunai')).toBe('Lunas Cash');
    });

    it('mengubah metode Transfer menjadi Lunas Transfer', () => {
      expect(getStatusLunasByMetode('Transfer')).toBe('Lunas Transfer');
    });

    it('default ke Lunas Cash jika metode kosong atau tidak dikenal', () => {
      expect(getStatusLunasByMetode('')).toBe('Lunas Cash');
      expect(getStatusLunasByMetode(null)).toBe('Lunas Cash');
      expect(getStatusLunasByMetode(undefined)).toBe('Lunas Cash');
      expect(getStatusLunasByMetode('Lainnya')).toBe('Lunas Cash');
    });
  });

  describe('isStatusLunas', () => {
    it('mengembalikan true untuk semua varian Lunas', () => {
      expect(isStatusLunas('Lunas')).toBe(true);
      expect(isStatusLunas('lunas')).toBe(true);
      expect(isStatusLunas('Lunas QRIS')).toBe(true);
      expect(isStatusLunas('Lunas Cash')).toBe(true);
      expect(isStatusLunas('Lunas Deposit')).toBe(true);
      expect(isStatusLunas('Lunas Transfer')).toBe(true);
    });

    it('mengembalikan false untuk status belum lunas atau DP', () => {
      expect(isStatusLunas('Belum Lunas')).toBe(false);
      expect(isStatusLunas('Belum Bayar')).toBe(false);
      expect(isStatusLunas('DP')).toBe(false);
      expect(isStatusLunas('')).toBe(false);
      expect(isStatusLunas(null)).toBe(false);
      expect(isStatusLunas(undefined)).toBe(false);
    });
  });
});

