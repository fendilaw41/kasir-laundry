/**
 * Helper utilitas untuk memvalidasi dan mengelola sesi autentikasi (JWT Token) di frontend.
 */

/**
 * Decode payload JWT tanpa library eksternal
 * @param {string} token
 * @returns {object|null}
 */
export const parseJwt = (token) => {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

/**
 * Mengecek apakah token JWT sudah kadaluwarsa (expired)
 * @param {string} token
 * @param {number} bufferSeconds - toleransi waktu sebelum exp (default 10 detik)
 * @returns {boolean}
 */
export const isTokenExpired = (token, bufferSeconds = 10) => {
  if (!token) return true;
  const payload = parseJwt(token);
  if (!payload || !payload.exp) return false; // jika token tidak memiliki exp, anggap valid

  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= currentTimeSeconds + bufferSeconds;
};

/**
 * Mengambil token autentikasi dari localStorage / sessionStorage
 * @returns {string|null}
 */
export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('auth_token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('token') ||
    null
  );
};

/**
 * Mengambil data user yang sedang login dari storage browser
 * @returns {object|null}
 */
export const getStoredUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Memicu event global auth:unauthorized agar aplikasi melakukan logout otomatis
 * @param {string} reason
 */
export const triggerUnauthorized = (reason = 'Sesi telah berakhir.') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { reason } }));
  }
};

/**
 * Memeriksa validitas sesi aktif.
 * Jika token kadaluwarsa, otomatis memicu triggerUnauthorized() dan mengembalikan false.
 * @returns {boolean}
 */
export const validateAuthSession = () => {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!user) return false;

  if (token && isTokenExpired(token)) {
    console.warn('[AuthSession] Token kadaluwarsa (JWT exp tercapai). Memicu logout otomatis.');
    triggerUnauthorized('Token login telah kedaluwarsa. Silakan masuk kembali.');
    return false;
  }

  // Sinkronkan sessionStorage jika user hanya ada di localStorage (misal setelah refresh/tab baru)
  if (typeof window !== 'undefined' && !sessionStorage.getItem('user') && localStorage.getItem('user')) {
    sessionStorage.setItem('user', localStorage.getItem('user'));
  }
  if (typeof window !== 'undefined' && !sessionStorage.getItem('token') && token) {
    sessionStorage.setItem('token', token);
  }

  return true;
};

