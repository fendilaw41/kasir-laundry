import { db } from '../../db';
import { DEFAULT_PLANS } from './plans.constants';

export { DEFAULT_PLANS } from './plans.constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Query function untuk useLiveQuery di React component.
 * Membaca dari Dexie dan otomatis seed data default jika tabel plans di Dexie masih kosong.
 */
export const getPlansQuery = async () => {
  if (!db.plans) return DEFAULT_PLANS;
  try {
    const list = await db.plans.orderBy('sortOrder').toArray();
    if (list && list.length > 0) {
      return list.filter((p) => p.isActive !== false);
    }
    // Seed default plans ke Dexie jika tabel plans kosong
    await db.transaction('rw', db.plans, async () => {
      for (const p of DEFAULT_PLANS) {
        await db.plans.put({
          ...p,
          key: p.key.toUpperCase(),
          updatedAt: new Date(),
        });
      }
    });
    const seeded = await db.plans.orderBy('sortOrder').toArray();
    return seeded.filter((p) => p.isActive !== false);
  } catch (err) {
    console.warn('[Plans] Error membaca/seed plans dari Dexie:', err);
    return DEFAULT_PLANS;
  }
};

/**
 * Mengambil daftar master plan lokal dari Dexie
 */
export const getAllPlansLocal = async () => {
  try {
    if (db.plans) {
      const list = await db.plans.orderBy('sortOrder').toArray();
      if (list && list.length > 0) {
        return list.filter((p) => p.isActive !== false);
      }
    }
  } catch (err) {
    console.warn('Gagal membaca plans dari Dexie:', err);
  }
  return DEFAULT_PLANS;
};

/**
 * Mengambil plan tertentu dari Dexie berdasarkan key (misal 'BASIC')
 */
export const getPlanByKey = async (key) => {
  if (!key) return DEFAULT_PLANS[0];
  const cleanKey = String(key).trim().toUpperCase();
  try {
    if (db.plans) {
      const p = await db.plans.get(cleanKey);
      if (p) return p;
    }
  } catch (err) {}
  return DEFAULT_PLANS.find((p) => p.key === cleanKey) || DEFAULT_PLANS[0];
};

let inFlightPlansPromise = null;
let lastPlansSyncTime = 0;
const PLANS_SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit cooldown

export const _resetPlansSyncCooldownForTests = () => {
  lastPlansSyncTime = 0;
  inFlightPlansPromise = null;
};

/**
 * Sinkronisasi Master Plan dari database backend ke Dexie
 */
export const syncPlansFromBackend = async (force = false) => {
  const now = Date.now();
  if (!force && (now - lastPlansSyncTime < PLANS_SYNC_COOLDOWN_MS)) {
    return getAllPlansLocal();
  }

  if (inFlightPlansPromise) {
    return inFlightPlansPromise;
  }

  inFlightPlansPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${API_URL}/subscription/plans`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && Array.isArray(json.plans) && json.plans.length > 0) {
        lastPlansSyncTime = Date.now();
        if (db.plans) {
          await db.transaction('rw', db.plans, async () => {
            for (const plan of json.plans) {
              await db.plans.put({
                ...plan,
                key: plan.key.toUpperCase(),
                updatedAt: new Date(plan.updatedAt || new Date()),
              });
            }
          });
        }
        return json.plans;
      }
    } catch (err) {
      console.warn('Sync plans dari backend gagal, menggunakan data lokal Dexie:', err);
    } finally {
      inFlightPlansPromise = null;
    }
    return getAllPlansLocal();
  })();

  return inFlightPlansPromise;
};
