import { db } from '../db';
import { getStoredUser } from './authSession';

/**
 * Mendapatkan identifikasi unik user yang sedang aktif
 * @param {object|null} user
 * @returns {string}
 */
export const getUserKey = (user) => {
  const activeUser = user || getStoredUser();
  return activeUser?.id || activeUser?.uuid || activeUser?.username || 'default';
};

/**
 * Mengambil setting isEnabledKasir (Floating Bayar Kasir) untuk user tertentu
 * Default: true
 * @param {object|null} user
 * @returns {boolean}
 */
export const getIsEnabledKasir = (user) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;
  const userKey = getUserKey(user);

  // 1. Cek preference spesifik per-user
  if (userKey && userKey !== 'default') {
    const userPref = localStorage.getItem(`user_${userKey}_isEnabledKasir`);
    if (userPref !== null) return userPref === 'true';

    const altPref = localStorage.getItem(`isEnabledKasir_${userKey}`);
    if (altPref !== null) return altPref === 'true';

    // 2. Cek object user di storage
    const activeUser = user || getStoredUser();
    if (activeUser && typeof activeUser.isEnabledKasir === 'boolean') {
      return activeUser.isEnabledKasir;
    }

    return true;
  }

  // 3. Fallback generic key jika tanpa user
  const legacy = localStorage.getItem('isEnabledKasir');
  if (legacy !== null) return legacy === 'true';

  return true;
};

/**
 * Menyimpan setting isEnabledKasir ke localStorage dan Dexie tabel user
 * @param {boolean} val
 * @param {object|null} user
 */
export const setIsEnabledKasir = (val, user) => {
  const boolVal = Boolean(val);
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const userKey = getUserKey(user);

  // Simpan di localStorage (per user & fallback)
  localStorage.setItem(`user_${userKey}_isEnabledKasir`, String(boolVal));
  localStorage.setItem(`isEnabledKasir_${userKey}`, String(boolVal));
  localStorage.setItem('isEnabledKasir', String(boolVal));

  // Update object user di storage
  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      u.isEnabledKasir = boolVal;
      localStorage.setItem('user', JSON.stringify(u));
    }
    const rawSession = sessionStorage.getItem('user');
    if (rawSession) {
      const su = JSON.parse(rawSession);
      su.isEnabledKasir = boolVal;
      sessionStorage.setItem('user', JSON.stringify(su));
    }
  } catch (e) {
    // ignore
  }

  // Update Dexie db.users
  const activeUser = user || getStoredUser();
  if (activeUser && (activeUser.id || activeUser.uuid || activeUser.username)) {
    (async () => {
      try {
        if (activeUser.id) {
          await db.users.update(activeUser.id, { isEnabledKasir: boolVal });
        } else if (activeUser.uuid) {
          const match = await db.users.where('uuid').equals(activeUser.uuid).first();
          if (match?.id) await db.users.update(match.id, { isEnabledKasir: boolVal });
        } else if (activeUser.username) {
          const match = await db.users.where('username').equals(activeUser.username).first();
          if (match?.id) await db.users.update(match.id, { isEnabledKasir: boolVal });
        }
      } catch (err) {
        console.warn('[UserPreferences] Gagal update Dexie user:', err);
      }
    })();
  }
};

/**
 * Mengambil setting isEnabledCetak (Floating Cetak di Nota) untuk user tertentu
 * Default: true
 * @param {object|null} user
 * @returns {boolean}
 */
export const getIsEnabledCetak = (user) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;
  const userKey = getUserKey(user);

  if (userKey && userKey !== 'default') {
    const userPref = localStorage.getItem(`user_${userKey}_isEnabledCetak`);
    if (userPref !== null) return userPref === 'true';

    const altPref = localStorage.getItem(`isEnabledCetak_${userKey}`);
    if (altPref !== null) return altPref === 'true';

    const activeUser = user || getStoredUser();
    if (activeUser && typeof activeUser.isEnabledCetak === 'boolean') {
      return activeUser.isEnabledCetak;
    }

    return true;
  }

  const legacy = localStorage.getItem('isEnabledCetak');
  if (legacy !== null) return legacy === 'true';

  return true;
};

/**
 * Menyimpan setting isEnabledCetak ke localStorage dan Dexie tabel user
 * @param {boolean} val
 * @param {object|null} user
 */
export const setIsEnabledCetak = (val, user) => {
  const boolVal = Boolean(val);
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const userKey = getUserKey(user);

  localStorage.setItem(`user_${userKey}_isEnabledCetak`, String(boolVal));
  localStorage.setItem(`isEnabledCetak_${userKey}`, String(boolVal));
  localStorage.setItem('isEnabledCetak', String(boolVal));

  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      u.isEnabledCetak = boolVal;
      localStorage.setItem('user', JSON.stringify(u));
    }
    const rawSession = sessionStorage.getItem('user');
    if (rawSession) {
      const su = JSON.parse(rawSession);
      su.isEnabledCetak = boolVal;
      sessionStorage.setItem('user', JSON.stringify(su));
    }
  } catch (e) {
    // ignore
  }

  const activeUser = user || getStoredUser();
  if (activeUser && (activeUser.id || activeUser.uuid || activeUser.username)) {
    (async () => {
      try {
        if (activeUser.id) {
          await db.users.update(activeUser.id, { isEnabledCetak: boolVal });
        } else if (activeUser.uuid) {
          const match = await db.users.where('uuid').equals(activeUser.uuid).first();
          if (match?.id) await db.users.update(match.id, { isEnabledCetak: boolVal });
        } else if (activeUser.username) {
          const match = await db.users.where('username').equals(activeUser.username).first();
          if (match?.id) await db.users.update(match.id, { isEnabledCetak: boolVal });
        }
      } catch (err) {
        console.warn('[UserPreferences] Gagal update Dexie user:', err);
      }
    })();
  }
};

/**
 * Mengambil setting ukuran drawer cetak (compact vs expand)
 * @param {object|null} user
 * @returns {boolean}
 */
export const getIsCompactCetak = (user) => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return false;
  const userKey = getUserKey(user);
  if (userKey && userKey !== 'default') {
    const pref = localStorage.getItem(`user_${userKey}_isCompactCetak`);
    if (pref !== null) return pref === 'true';
    return false;
  }
  const legacy = localStorage.getItem('isCompactCetak');
  if (legacy !== null) return legacy === 'true';
  return false;
};

/**
 * Menyimpan ukuran drawer cetak (compact vs expand)
 * @param {boolean} val
 * @param {object|null} user
 */
export const setIsCompactCetak = (val, user) => {
  const boolVal = Boolean(val);
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const userKey = getUserKey(user);
  localStorage.setItem(`user_${userKey}_isCompactCetak`, String(boolVal));
  localStorage.setItem('isCompactCetak', String(boolVal));
};
