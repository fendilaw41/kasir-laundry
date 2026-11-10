import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseJwt,
  isTokenExpired,
  getStoredToken,
  getStoredUser,
  triggerUnauthorized,
  validateAuthSession,
} from './authSession';

// Helper untuk membuat dummy JWT token
const createMockJwt = (payload) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

describe('authSession utility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('parseJwt', () => {
    it('returns null for empty or invalid token format', () => {
      expect(parseJwt('')).toBeNull();
      expect(parseJwt('invalid_string')).toBeNull();
      expect(parseJwt(null)).toBeNull();
    });

    it('successfully parses valid JWT payload', () => {
      const payload = { id: 'u1', username: 'owner1', storeId: 's1' };
      const token = createMockJwt(payload);
      expect(parseJwt(token)).toMatchObject(payload);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true if token is empty', () => {
      expect(isTokenExpired('')).toBe(true);
      expect(isTokenExpired(null)).toBe(true);
    });

    it('returns true if token exp is in the past', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60; // 1 menit lalu
      const token = createMockJwt({ exp: pastExp });
      expect(isTokenExpired(token)).toBe(true);
    });

    it('returns false if token exp is in the future', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 jam lagi
      const token = createMockJwt({ exp: futureExp });
      expect(isTokenExpired(token)).toBe(false);
    });
  });

  describe('getStoredToken & getStoredUser', () => {
    it('retrieves token from localStorage or sessionStorage', () => {
      localStorage.setItem('auth_token', 'jwt_test_123');
      expect(getStoredToken()).toBe('jwt_test_123');

      localStorage.clear();
      sessionStorage.setItem('token', 'jwt_session_123');
      expect(getStoredToken()).toBe('jwt_session_123');
    });

    it('retrieves user from sessionStorage or localStorage', () => {
      const user = { username: 'kasir1', role: 'kasir' };
      localStorage.setItem('user', JSON.stringify(user));
      expect(getStoredUser()).toEqual(user);
    });
  });

  describe('validateAuthSession', () => {
    it('returns false if no user is stored', () => {
      expect(validateAuthSession()).toBe(false);
    });

    it('triggers unauthorized and returns false if token is expired', () => {
      const spy = vi.spyOn(window, 'dispatchEvent');
      const pastExp = Math.floor(Date.now() / 1000) - 30;
      const expiredToken = createMockJwt({ exp: pastExp, user: 'test' });

      localStorage.setItem('auth_token', expiredToken);
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test' }));

      const isValid = validateAuthSession();
      expect(isValid).toBe(false);
      expect(spy).toHaveBeenCalled();
    });

    it('synchronizes sessionStorage and returns true for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 7200;
      const validToken = createMockJwt({ exp: futureExp });
      const user = { id: 1, name: 'Admin' };

      localStorage.setItem('auth_token', validToken);
      localStorage.setItem('user', JSON.stringify(user));

      expect(sessionStorage.getItem('user')).toBeNull();

      const isValid = validateAuthSession();
      expect(isValid).toBe(true);
      expect(sessionStorage.getItem('user')).toBe(JSON.stringify(user));
      expect(sessionStorage.getItem('token')).toBe(validToken);
    });
  });
});

