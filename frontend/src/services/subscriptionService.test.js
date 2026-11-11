import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSubscriptionReport,
  invalidateSubscriptionCache,
  _resetSubscriptionCacheForTests,
} from './subscriptionService';
import {
  syncNotificationsFromBackend,
  _resetNotificationCooldownForTests,
} from '../db/repositories/notifications';
import {
  fetchConversationsFromBackend,
  _resetConversationsCooldownForTests,
} from './chatService';

vi.mock('../db.js', () => {
  return {
    db: {
      settings: {
        get: vi.fn().mockResolvedValue({ id: 1, token: 'mock-token', storeId: 'store-1' }),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            modify: vi.fn().mockResolvedValue(1),
          })),
        })),
      },
      storeSubscriptions: {
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
          })),
        })),
        put: vi.fn().mockResolvedValue(true),
      },
      notifications: {
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            first: vi.fn().mockResolvedValue(null),
          })),
        })),
        add: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(1),
      },
      conversations: {
        toArray: vi.fn().mockResolvedValue([]),
        bulkPut: vi.fn().mockResolvedValue(true),
        orderBy: vi.fn(() => ({
          reverse: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([]),
          })),
        })),
      },
      transaction: vi.fn(async (mode, tables, callback) => {
        await callback();
      }),
    },
  };
});

describe('API Duplication Prevention & Cooldown Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSubscriptionCacheForTests();
    _resetNotificationCooldownForTests();
    _resetConversationsCooldownForTests();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('auth_token', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', username: 'owner', role: 'owner', storeId: 's1', featureSubscriptionEnabled: true }));
  });

  describe('getSubscriptionReport', () => {
    it('deduplicates concurrent calls to /subscription/usage and uses cached report', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            plan: 'STARTER',
            status: 'ACTIVE',
            limits: { maxTransactions: 100 },
            usage: { transactions: { used: 10, remaining: 90 } },
          },
        }),
      });

      // 3 concurrent calls (e.g. from StrictMode or multiple components on page load)
      const [r1, r2, r3] = await Promise.all([
        getSubscriptionReport(),
        getSubscriptionReport(),
        getSubscriptionReport(),
      ]);

      // fetch should only be called once for usage
      const usageCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/subscription/usage'));
      expect(usageCalls).toHaveLength(1);
      expect(r1.plan).toBe('STARTER');
      expect(r2.plan).toBe('STARTER');
      expect(r3.plan).toBe('STARTER');

      // Subsequent call within cache TTL should not fetch again
      await getSubscriptionReport();
      const usageCallsAfter = global.fetch.mock.calls.filter(([url]) => String(url).includes('/subscription/usage'));
      expect(usageCallsAfter).toHaveLength(1);

      // Force = true should bypass cache
      await getSubscriptionReport({ force: true });
      const usageCallsForced = global.fetch.mock.calls.filter(([url]) => String(url).includes('/subscription/usage'));
      expect(usageCallsForced).toHaveLength(2);
    });
  });

  describe('syncNotificationsFromBackend', () => {
    it('deduplicates concurrent calls to /notifications and respects cooldown', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          notifications: [
            { id: 'n1', title: 'Test Notif', isRead: false },
          ],
        }),
      });

      // 3 concurrent calls
      await Promise.all([
        syncNotificationsFromBackend(),
        syncNotificationsFromBackend(),
        syncNotificationsFromBackend(),
      ]);

      const notifCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/notifications'));
      expect(notifCalls).toHaveLength(1);

      // Cooldown test
      await syncNotificationsFromBackend();
      expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/notifications'))).toHaveLength(1);

      // Force refresh (e.g. user clicks bell)
      await syncNotificationsFromBackend(true);
      expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/notifications'))).toHaveLength(2);
    });
  });

  describe('fetchConversationsFromBackend', () => {
    it('deduplicates concurrent calls to /chat/conversations and respects cooldown', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'c1', title: 'Chat 1' }],
        }),
      });

      // 3 concurrent calls
      await Promise.all([
        fetchConversationsFromBackend(),
        fetchConversationsFromBackend(),
        fetchConversationsFromBackend(),
      ]);

      const convCalls = global.fetch.mock.calls.filter(([url]) => String(url).includes('/chat/conversations'));
      expect(convCalls).toHaveLength(1);

      // Cooldown test
      await fetchConversationsFromBackend();
      expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/chat/conversations'))).toHaveLength(1);

      // Force refresh
      await fetchConversationsFromBackend(true);
      expect(global.fetch.mock.calls.filter(([url]) => String(url).includes('/chat/conversations'))).toHaveLength(2);
    });
  });
});

