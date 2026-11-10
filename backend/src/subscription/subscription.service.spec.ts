import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { getPlanLimits } from './subscription.constants';
import { ForbiddenException } from '@nestjs/common';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let prisma: any;
  let storage: any;

  beforeEach(async () => {
    process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = 'true';
    process.env.PLAN_BUSINESS_MAX_TRANSACTIONS = '1000';

    prisma = {
      storeSubscription: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        count: jest.fn(),
      },
      message: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        count: jest.fn(),
      },
      inventory: {
        count: jest.fn(),
      },
      product: {
        count: jest.fn().mockResolvedValue(10),
      },
      store: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          id: 'store-test-1',
          featureSubscriptionEnabled: true,
          showUpgradeBanner: true,
        }),
      },
    };

    storage = {
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct plan limits including Business FUP 1000 and maxProducts tiers', () => {
    const limits = getPlanLimits();
    expect(limits.TRIAL.maxTransactions).toBe(30);
    expect(limits.STARTER.maxTransactions).toBe(100);
    expect(limits.BASIC.maxTransactions).toBe(150);
    expect(limits.PRO.maxTransactions).toBe(300);
    expect(limits.BUSINESS.maxTransactions).toBe(1000);
    expect(limits.BASIC.isPopular).toBe(true);

    // Verifikasi batas produk sesuai tier baru
    expect(limits.TRIAL.maxProducts).toBe(12);
    expect(limits.STARTER.maxProducts).toBe(20);
    expect(limits.BASIC.maxProducts).toBe(50);
    expect(limits.PRO.maxProducts).toBe(100);
    expect(limits.BUSINESS.maxProducts).toBe(-1);

    // Verifikasi foto chat
    expect(limits.TRIAL.maxChatPhotos).toBe(5);
    expect(limits.STARTER.maxChatPhotos).toBe(5);
    expect(limits.BASIC.maxChatPhotos).toBe(20);
    expect(limits.PRO.maxChatPhotos).toBe(100);
    expect(limits.BUSINESS.maxChatPhotos).toBe(500);

    // Verifikasi bot transaksi
    expect(limits.TRIAL.botTransactions).toBe(10);
    expect(limits.STARTER.botTransactions).toBe(0);
    expect(limits.BASIC.botTransactions).toBe(20);
    expect(limits.PRO.botTransactions).toBe(200);
    expect(limits.BUSINESS.botTransactions).toBe(1000);

    // Verifikasi history stok
    expect(limits.TRIAL.hasStockHistory).toBe(false);
    expect(limits.STARTER.hasStockHistory).toBe(false);
    expect(limits.BASIC.hasStockHistory).toBe(true);
    expect(limits.PRO.hasStockHistory).toBe(true);
    expect(limits.BUSINESS.hasStockHistory).toBe(true);

    // Verifikasi jumlah kasir
    expect(limits.TRIAL.maxUsers).toBe(2);
    expect(limits.STARTER.maxUsers).toBe(2);
    expect(limits.BASIC.maxUsers).toBe(3);
    expect(limits.PRO.maxUsers).toBe(5);
    expect(limits.BUSINESS.maxUsers).toBe(-1);
  });

  it('should calculate usage report and flag 80% warning correctly', async () => {
    const storeId = 'store-test-1';
    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      storeId,
      plan: SubscriptionPlan.BASIC,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
      topupTransactions: 0,
      topupPhotos: 0,
    });

    // 128 of 150 is 85%
    prisma.order.count.mockResolvedValue(128);
    prisma.message.count.mockResolvedValue(50);
    prisma.user.count.mockResolvedValue(2);
    prisma.inventory.count.mockResolvedValue(10);

    const report = await service.getUsageReport(storeId);
    expect(report.usage.transactions.used).toBe(128);
    expect(report.usage.transactions.percentage).toBe(85);
    expect(report.usage.transactions.isWarning).toBe(true);
    expect(report.usage.transactions.isExceeded).toBe(false);
  });

  it('should throw ForbiddenException when 100% transaction limit reached', async () => {
    const storeId = 'store-test-2';
    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-2',
      storeId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
      topupTransactions: 0,
      topupPhotos: 0,
    });

    // Limit Starter is 100
    prisma.order.count.mockResolvedValue(100);
    prisma.message.count.mockResolvedValue(10);
    prisma.user.count.mockResolvedValue(1);
    prisma.inventory.count.mockResolvedValue(2);

    await expect(
      service.assertCanPerformAction(storeId, 'CREATE_ORDER'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should bypass limit check when SUBSCRIPTION_ENFORCEMENT_ENABLED is false', async () => {
    process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = 'false';
    const result = await service.assertCanPerformAction('store-any', 'CREATE_ORDER');
    expect(result).toBe(true);
  });

  it('should bypass limit check when store featureSubscriptionEnabled is false', async () => {
    prisma.store.findUnique.mockResolvedValueOnce({
      id: 'store-unlimited',
      featureSubscriptionEnabled: false,
      showUpgradeBanner: false,
    });
    const result = await service.assertCanPerformAction('store-unlimited', 'CREATE_ORDER');
    expect(result).toBe(true);
  });

  it('should block inventory creation when limit reached on Trial plan (3 items)', async () => {
    const storeId = 'store-test-trial';
    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-3',
      storeId,
      plan: SubscriptionPlan.TRIAL,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
      topupTransactions: 0,
      topupPhotos: 0,
    });

    prisma.order.count.mockResolvedValue(5);
    prisma.message.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(1);
    prisma.inventory.count.mockResolvedValue(3);

    await expect(
      service.assertCanPerformAction(storeId, 'CREATE_INVENTORY'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should block product creation when product limit reached on Trial plan (5 items)', async () => {
    const storeId = 'store-test-trial-product';
    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-4',
      storeId,
      plan: SubscriptionPlan.TRIAL,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000 * 30),
      topupTransactions: 0,
      topupPhotos: 0,
    });

    prisma.order.count.mockResolvedValue(5);
    prisma.message.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(1);
    prisma.inventory.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValue(12); // Kuota 12/12 tercapai

    await expect(
      service.assertCanPerformAction(storeId, 'CREATE_PRODUCT'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should prioritize SUBSCRIPTION_EXPIRED when expired even if transaction quota is still remaining', async () => {
    process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = 'true';
    const storeId = 'store-expired-with-quota';
    const pastDate = new Date(Date.now() - 86400000 * 2); // 2 days ago

    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-exp',
      storeId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.EXPIRED,
      currentPeriodStart: new Date(Date.now() - 86400000 * 32),
      currentPeriodEnd: pastDate,
      topupTransactions: 0,
      topupPhotos: 0,
    });

    // Only 10 orders used out of 100 limit (still has 90 remaining quota)
    prisma.order.count.mockResolvedValue(10);
    prisma.message.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(1);
    prisma.inventory.count.mockResolvedValue(0);

    let thrownError: any;
    try {
      await service.assertCanPerformAction(storeId, 'CREATE_ORDER');
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ForbiddenException);
    expect(thrownError.getResponse().error).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('should allow chat message and photo upload but block other actions when paid subscription is expired', async () => {
    process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = 'true';
    const storeId = 'store-expired-paid';
    const pastDate = new Date(Date.now() - 86400000 * 2);

    prisma.storeSubscription.findUnique.mockResolvedValue({
      id: 'sub-exp-paid',
      storeId,
      plan: SubscriptionPlan.STARTER,
      status: SubscriptionStatus.EXPIRED,
      currentPeriodStart: new Date(Date.now() - 86400000 * 32),
      currentPeriodEnd: pastDate,
      topupTransactions: 0,
      topupPhotos: 0,
    });

    prisma.order.count.mockResolvedValue(10);
    prisma.message.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(1);
    prisma.inventory.count.mockResolvedValue(0);

    // Chat dan foto chat DIPERBOLEHKAN
    expect(await service.assertCanPerformAction(storeId, 'SEND_CHAT_MESSAGE')).toBe(true);
    expect(await service.assertCanPerformAction(storeId, 'UPLOAD_CHAT_PHOTO')).toBe(true);

    // Selain itu BLOKIR SEMUA:
    const blockedActions = [
      'CREATE_ORDER',
      'CREATE_INVENTORY',
      'CREATE_USER',
      'CREATE_PRODUCT',
      'USE_CHATBOT',
      'EDIT_DATA',
      'VIEW_STOCK_HISTORY',
    ] as const;

    for (const action of blockedActions) {
      await expect(service.assertCanPerformAction(storeId, action)).rejects.toThrow(
        ForbiddenException,
      );
    }

    await expect(
      service.assertCanPerformAction(storeId, 'UPDATE_ORDER', { isStatusOnly: true }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('Trial Expired Strict Rules', () => {
    const trialStoreId = 'store-trial-expired';
    const pastDate = new Date(Date.now() - 86400000 * 3);

    beforeEach(() => {
      process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED = 'true';
      prisma.storeSubscription.findUnique.mockResolvedValue({
        id: 'sub-trial-exp',
        storeId: trialStoreId,
        plan: SubscriptionPlan.TRIAL,
        status: SubscriptionStatus.EXPIRED,
        currentPeriodStart: new Date(Date.now() - 86400000 * 33),
        currentPeriodEnd: pastDate,
        topupTransactions: 0,
        topupPhotos: 0,
      });

      prisma.order.count.mockResolvedValue(5);
      prisma.message.count.mockResolvedValue(1);
      prisma.user.count.mockResolvedValue(1);
      prisma.inventory.count.mockResolvedValue(0);
      prisma.product.count.mockResolvedValue(3);
    });

    it('should block chat message, photo, inventory, user, product, bot, order when trial is expired', async () => {
      const blockedActions = [
        'CREATE_ORDER',
        'SEND_CHAT_MESSAGE',
        'UPLOAD_CHAT_PHOTO',
        'USE_CHATBOT',
        'CREATE_INVENTORY',
        'CREATE_USER',
        'CREATE_PRODUCT',
        'EDIT_DATA',
      ] as const;

      for (const action of blockedActions) {
        await expect(service.assertCanPerformAction(trialStoreId, action)).rejects.toThrow(
          ForbiddenException,
        );
      }
    });

    it('should allow status-only order update when trial is expired', async () => {
      const result = await service.assertCanPerformAction(trialStoreId, 'UPDATE_ORDER', {
        isStatusOnly: true,
      });
      expect(result).toBe(true);
    });

    it('should block non-status order update when trial is expired', async () => {
      await expect(
        service.assertCanPerformAction(trialStoreId, 'UPDATE_ORDER', {
          isStatusOnly: false,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

