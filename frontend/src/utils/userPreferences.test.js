import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getIsEnabledKasir,
  setIsEnabledKasir,
  getIsEnabledCetak,
  setIsEnabledCetak,
  getIsCompactCetak,
  setIsCompactCetak,
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

