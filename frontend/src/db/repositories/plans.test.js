import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../../db.js';
import {
  DEFAULT_PLANS,
  getPlansQuery,
  getAllPlansLocal,
  getPlanByKey,
  syncPlansFromBackend,
  _resetPlansSyncCooldownForTests,
} from './plans.js';

vi.mock('../../db.js', () => {
  const store = new Map();
  return {
    db: {
      plans: {
        get: vi.fn(async (key) => store.get(key)),
        put: vi.fn(async (item) => store.set(item.key, item)),
        clear: vi.fn(async () => store.clear()),
        orderBy: vi.fn(() => ({
          toArray: vi.fn(async () => Array.from(store.values())),
        })),
      },
      transaction: vi.fn(async (mode, tables, callback) => {
        await callback();
      }),
    },
  };
});

describe('plans repository', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _resetPlansSyncCooldownForTests();
    await db.plans.clear();
  });

  it('provides default 5 master plans', () => {
    expect(DEFAULT_PLANS).toHaveLength(5);
    const keys = DEFAULT_PLANS.map((p) => p.key);
    expect(keys).toEqual(['TRIAL', 'STARTER', 'BASIC', 'PRO', 'BUSINESS']);
  });

  it('getPlansQuery returns fallback when Dexie plans table is empty', async () => {
    const plans = await getPlansQuery();
    expect(plans).toHaveLength(5);
    expect(plans[0].key).toBe('TRIAL');
  });

  it('getPlanByKey returns specific plan configuration', async () => {
    const starter = await getPlanByKey('STARTER');
    expect(starter).toBeDefined();
    expect(starter.key).toBe('STARTER');
    expect(starter.price).toBe(25000);
    expect(starter.maxTransactions).toBe(100);
  });

  it('syncPlansFromBackend fetches and stores plans in Dexie', async () => {
    const mockBackendPlans = [
      {
        id: 'plan-1',
        key: 'TRIAL',
        name: 'Trial Custom',
        price: 0,
        priceLabel: 'Gratis',
        maxTransactions: 50, // Custom edited limit
        maxStockItems: 10,
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 'plan-2',
        key: 'PRO',
        name: 'Pro Custom',
        price: 120000,
        priceLabel: '120rb/bln',
        maxTransactions: 2500,
        maxStockItems: 100,
        sortOrder: 2,
        isActive: true,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        plans: mockBackendPlans,
      }),
    });

    const result = await syncPlansFromBackend();
    expect(result).toHaveLength(2);

    // Verify stored in Dexie
    const storedTrial = await db.plans.get('TRIAL');
    expect(storedTrial).toBeDefined();
    expect(storedTrial.name).toBe('Trial Custom');
    expect(storedTrial.maxTransactions).toBe(50);
    expect(storedTrial.maxStockItems).toBe(10);

    const queried = await getPlansQuery();
    expect(queried).toHaveLength(2);
    expect(queried[0].maxTransactions).toBe(50);
  });

  it('deduplicates concurrent syncPlansFromBackend calls and respects cooldown', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        plans: [{ key: 'TRIAL', name: 'Trial', maxTransactions: 50 }],
      }),
    });

    // Panggil 3 kali bersamaan (concurrent)
    const [res1, res2, res3] = await Promise.all([
      syncPlansFromBackend(),
      syncPlansFromBackend(),
      syncPlansFromBackend(),
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res1).toBeDefined();
    expect(res2).toBeDefined();
    expect(res3).toBeDefined();

    // Panggilan berikutnya dalam cooldown tidak memicu fetch baru
    await syncPlansFromBackend();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Panggilan dengan force=true memicu fetch baru
    await syncPlansFromBackend(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
