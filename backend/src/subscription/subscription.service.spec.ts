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
    process.env.PLAN_BUSINESS_MAX_TRANSACTIONS = '3000';

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

  it('should return correct plan limits including Business FUP 3000', () => {
    const limits = getPlanLimits();
    expect(limits.TRIAL.maxTransactions).toBe(30);
    expect(limits.STARTER.maxTransactions).toBe(150);
    expect(limits.BASIC.maxTransactions).toBe(400);
    expect(limits.PRO.maxTransactions).toBe(1000);
    expect(limits.BUSINESS.maxTransactions).toBe(3000);
    expect(limits.BASIC.isPopular).toBe(true);
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

    // 340 of 400 is 85%
    prisma.order.count.mockResolvedValue(340);
    prisma.message.count.mockResolvedValue(50);
    prisma.user.count.mockResolvedValue(2);
    prisma.inventory.count.mockResolvedValue(10);

    const report = await service.getUsageReport(storeId);
    expect(report.usage.transactions.used).toBe(340);
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

    // Limit Starter is 150
    prisma.order.count.mockResolvedValue(150);
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

  it('should block inventory creation on Trial plan', async () => {
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
    prisma.inventory.count.mockResolvedValue(0);

    await expect(
      service.assertCanPerformAction(storeId, 'CREATE_INVENTORY'),
    ).rejects.toThrow(ForbiddenException);
  });
});

