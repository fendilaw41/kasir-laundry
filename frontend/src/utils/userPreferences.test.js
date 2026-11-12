import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIsEnabledKasir,
  setIsEnabledKasir,
  getIsEnabledCetak,
  setIsEnabledCetak,
  getIsCompactCetak,
  setIsCompactCetak,
  getIsMiniPayment,
  setIsMiniPayment,
  getShowPaymentDrawer,
  setShowPaymentDrawerPref,
  getUserKey
} from './userPreferences';

describe('userPreferences utility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const mockUser1 = { id: 'usr-1', username: 'kasir1' };
  const mockUser2 = { id: 'usr-2', username: 'kasir2' };

  it('mengembalikan default true untuk isEnabledKasir dan isEnabledCetak', () => {
    expect(getIsEnabledKasir(mockUser1)).toBe(true);
    expect(getIsEnabledCetak(mockUser1)).toBe(true);
    expect(getIsCompactCetak(mockUser1)).toBe(false);
  });

  it('menyimpan dan membaca isEnabledKasir secara per-user di localStorage', () => {
    setIsEnabledKasir(false, mockUser1);
    expect(getIsEnabledKasir(mockUser1)).toBe(false);
    // User 2 belum diubah, harus tetap default true
    expect(getIsEnabledKasir(mockUser2)).toBe(true);

    setIsEnabledKasir(true, mockUser1);
    expect(getIsEnabledKasir(mockUser1)).toBe(true);
  });

  it('menyimpan dan membaca isEnabledCetak secara per-user di localStorage', () => {
    setIsEnabledCetak(false, mockUser1);
    expect(getIsEnabledCetak(mockUser1)).toBe(false);
    expect(getIsEnabledCetak(mockUser2)).toBe(true);

    setIsEnabledCetak(true, mockUser1);
    expect(getIsEnabledCetak(mockUser1)).toBe(true);
  });

  it('menyimpan dan membaca ukuran cetak isCompactCetak', () => {
    setIsCompactCetak(true, mockUser1);
    expect(getIsCompactCetak(mockUser1)).toBe(true);
    expect(getIsCompactCetak(mockUser2)).toBe(false);
  });

  it('menyimpan dan membaca mode mini drawer kasir isMiniPayment', () => {
    // Default mode mini harus true
    expect(getIsMiniPayment(mockUser1)).toBe(true);
    expect(getIsMiniPayment(mockUser2)).toBe(true);

    // Set user 1 ke maximize (false)
    setIsMiniPayment(false, mockUser1);
    expect(getIsMiniPayment(mockUser1)).toBe(false);
    expect(getIsMiniPayment(mockUser2)).toBe(true);

    // Set user 1 kembali ke mini (true)
    setIsMiniPayment(true, mockUser1);
    expect(getIsMiniPayment(mockUser1)).toBe(true);
  });

  it('menyimpan dan membaca status open/close drawer kasir showPaymentDrawer', () => {
    // Default harus true
    expect(getShowPaymentDrawer(mockUser1)).toBe(true);

    // Set user 1 ke close (false)
    setShowPaymentDrawerPref(false, mockUser1);
    expect(getShowPaymentDrawer(mockUser1)).toBe(false);
    expect(getIsEnabledKasir(mockUser1)).toBe(false);
    expect(getShowPaymentDrawer(mockUser2)).toBe(true);

    // Set user 1 ke open (true)
    setShowPaymentDrawerPref(true, mockUser1);
    expect(getShowPaymentDrawer(mockUser1)).toBe(true);
    expect(getIsEnabledKasir(mockUser1)).toBe(true);
  });

  it('memperbarui object user di localStorage dan sessionStorage', () => {
    localStorage.setItem('user', JSON.stringify({ id: 'usr-1', username: 'kasir1' }));
    sessionStorage.setItem('user', JSON.stringify({ id: 'usr-1', username: 'kasir1' }));

    setIsEnabledKasir(false, mockUser1);
    setIsEnabledCetak(false, mockUser1);

    const updatedLocal = JSON.parse(localStorage.getItem('user'));
    expect(updatedLocal.isEnabledKasir).toBe(false);
    expect(updatedLocal.isEnabledCetak).toBe(false);

    const updatedSession = JSON.parse(sessionStorage.getItem('user'));
    expect(updatedSession.isEnabledKasir).toBe(false);
    expect(updatedSession.isEnabledCetak).toBe(false);
  });
});

