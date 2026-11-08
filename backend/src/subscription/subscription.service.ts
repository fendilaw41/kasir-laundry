import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { getPlanLimits, PlanLimits } from './subscription.constants';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

export interface UsageReport {
  plan: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  isEnforced: boolean;
  limits: PlanLimits;
  usage: {
    transactions: {
      used: number;
      limit: number;
      topup: number;
      totalLimit: number;
      remaining: number;
      percentage: number;
      isWarning: boolean;
      isExceeded: boolean;
    };
    photos: {
      used: number;
      limit: number;
      topup: number;
      totalLimit: number;
      remaining: number;
      percentage: number;
      isWarning: boolean;
      isExceeded: boolean;
      retentionDays: number;
      expiringSoonCount: number;
    };
    users: {
      used: number;
      limit: number;
      remaining: number;
      isExceeded: boolean;
    };
    inventory: {
      used: number;
      limit: number;
      remaining: number;
      isExceeded: boolean;
    };
  };
  whatsappBillingNumber: string;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  isEnforced(): boolean {
    return process.env.SUBSCRIPTION_ENFORCEMENT_ENABLED !== 'false';
  }

  /**
   * Mendapatkan atau membuat subscription toko secara otomatis
   */
  async getOrCreateSubscription(storeId: string) {
    let sub = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
    });

    if (!sub) {
      const defaultPlan = (process.env.DEFAULT_STORE_PLAN || 'TRIAL') as SubscriptionPlan;
      const trialDays = parseInt(process.env.TRIAL_DURATION_DAYS || '30', 10);
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + (trialDays > 0 ? trialDays : 30));

      sub = await this.prisma.storeSubscription.create({
        data: {
          storeId,
          plan: defaultPlan,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      this.logger.log(`Created default subscription for store ${storeId} with plan ${defaultPlan}`);
    }

    // Auto-check expired status
    const now = new Date();
    if (sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd < now) {
      sub = await this.prisma.storeSubscription.update({
        where: { storeId },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    }

    return sub;
  }

  /**
   * Hitung dan rangkum penggunaan kuota bulan berjalan
   */
  async getUsageReport(storeId: string): Promise<UsageReport> {
    const sub = await this.getOrCreateSubscription(storeId);
    const allLimits = getPlanLimits();
    const limits = allLimits[sub.plan] || allLimits.TRIAL;

    const periodStart = sub.currentPeriodStart;
    const warningPercentage = parseInt(process.env.SUBSCRIPTION_WARNING_PERCENTAGE || '80', 10);

    // 1. Hitung transaksi order bulan ini
    const usedTransactions = await this.prisma.order.count({
      where: {
        storeId,
        createdAt: { gte: periodStart },
        deletedAt: null,
      },
    });

    // 2. Hitung foto chat bulan ini
    const usedPhotos = await this.prisma.message.count({
      where: {
        conversation: { storeId },
        type: 'IMAGE',
        createdAt: { gte: periodStart },
        deletedAt: null,
      },
    });

    // 3. Hitung foto yang akan segera dibersihkan (7 hari menjelang batas retensi)
    const retentionDays = limits.photoRetentionDays || 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - retentionDays);
    const warningExpiryDate = new Date(expiryDate);
    warningExpiryDate.setDate(warningExpiryDate.getDate() + 7);

    const expiringSoonCount = await this.prisma.message.count({
      where: {
        conversation: { storeId },
        type: 'IMAGE',
        createdAt: { gte: expiryDate, lte: warningExpiryDate },
        deletedAt: null,
      },
    });

    // 4. Hitung kasir / user aktif
    const usedUsers = await this.prisma.user.count({
      where: {
        storeId,
        deletedAt: null,
      },
    });

    // 5. Hitung item inventori aktif
    const usedInventory = await this.prisma.inventory.count({
      where: {
        storeId,
        deletedAt: null,
      },
    });

    // Perhitungan kalkulasi limit + topup
    const totalTrxLimit = limits.maxTransactions === -1 ? 999999 : limits.maxTransactions + sub.topupTransactions;
    const trxPercentage = limits.maxTransactions === -1 ? 0 : Math.min(100, Math.round((usedTransactions / totalTrxLimit) * 100));
    const trxRemaining = limits.maxTransactions === -1 ? 999999 : Math.max(0, totalTrxLimit - usedTransactions);

    const totalPhotoLimit = limits.maxChatPhotos === -1 ? 999999 : limits.maxChatPhotos + sub.topupPhotos;
    const photoPercentage = limits.maxChatPhotos === -1 ? 0 : Math.min(100, Math.round((usedPhotos / totalPhotoLimit) * 100));
    const photoRemaining = limits.maxChatPhotos === -1 ? 999999 : Math.max(0, totalPhotoLimit - usedPhotos);

    const userLimit = limits.maxUsers;
    const inventoryLimit = limits.maxStockItems === -1 ? 999999 : limits.maxStockItems;

    return {
      plan: sub.plan,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      isEnforced: this.isEnforced(),
      limits,
      usage: {
        transactions: {
          used: usedTransactions,
          limit: limits.maxTransactions,
          topup: sub.topupTransactions,
          totalLimit: totalTrxLimit,
          remaining: trxRemaining,
          percentage: trxPercentage,
          isWarning: trxPercentage >= warningPercentage && trxPercentage < 100,
          isExceeded: usedTransactions >= totalTrxLimit,
        },
        photos: {
          used: usedPhotos,
          limit: limits.maxChatPhotos,
          topup: sub.topupPhotos,
          totalLimit: totalPhotoLimit,
          remaining: photoRemaining,
          percentage: photoPercentage,
          isWarning: photoPercentage >= warningPercentage && photoPercentage < 100,
          isExceeded: usedPhotos >= totalPhotoLimit,
          retentionDays,
          expiringSoonCount,
        },
        users: {
          used: usedUsers,
          limit: userLimit,
          remaining: Math.max(0, userLimit - usedUsers),
          isExceeded: usedUsers >= userLimit,
        },
        inventory: {
          used: usedInventory,
          limit: inventoryLimit,
          remaining: Math.max(0, inventoryLimit - usedInventory),
          isExceeded: limits.maxStockItems !== -1 && usedInventory >= inventoryLimit,
        },
      },
      whatsappBillingNumber: process.env.BILLING_WHATSAPP_NUMBER || '6281234567890',
    };
  }

  /**
   * Pengecekan penegakan kuota (Enforcement Guard)
   */
  async assertCanPerformAction(
    storeId: string,
    action: 'CREATE_ORDER' | 'UPLOAD_CHAT_PHOTO' | 'CREATE_USER' | 'CREATE_INVENTORY',
  ) {
    if (!this.isEnforced()) {
      return true; // Bypass jika fitur enforcement dimatikan via ENV
    }

    const report = await this.getUsageReport(storeId);

    // Cek jika status subscription expired
    if (report.status === SubscriptionStatus.EXPIRED) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Masa aktif paket langganan Anda telah berakhir. Silakan lakukan perpanjangan paket.',
        canTopup: false,
        whatsappBillingNumber: report.whatsappBillingNumber,
      });
    }

    if (action === 'CREATE_ORDER' && report.usage.transactions.isExceeded) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'TRANSACTION_LIMIT_EXCEEDED',
        message: `Kuota transaksi bulanan Anda telah mencapai batas (${report.usage.transactions.totalLimit}). Data lama tetap aman. Silakan lakukan top-up atau upgrade paket untuk menambah transaksi baru.`,
        canTopup: true,
        current: report.usage.transactions.used,
        limit: report.usage.transactions.totalLimit,
        whatsappBillingNumber: report.whatsappBillingNumber,
      });
    }

    if (action === 'UPLOAD_CHAT_PHOTO' && report.usage.photos.isExceeded) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PHOTO_LIMIT_EXCEEDED',
        message: `Kuota kirim foto chat bulanan Anda telah mencapai batas (${report.usage.photos.totalLimit}). Silakan top-up kuota foto atau upgrade paket.`,
        canTopup: true,
        current: report.usage.photos.used,
        limit: report.usage.photos.totalLimit,
        whatsappBillingNumber: report.whatsappBillingNumber,
      });
    }

    if (action === 'CREATE_USER' && report.usage.users.isExceeded) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'USER_LIMIT_EXCEEDED',
        message: `Jumlah user/kasir telah mencapai batas maksimal paket ${report.plan} (${report.limits.maxUsers} user). Silakan upgrade paket untuk menambah kasir baru.`,
        canTopup: false,
        current: report.usage.users.used,
        limit: report.limits.maxUsers,
        whatsappBillingNumber: report.whatsappBillingNumber,
      });
    }

    if (action === 'CREATE_INVENTORY') {
      if (report.limits.maxStockItems === 0) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'FEATURE_NOT_AVAILABLE',
          message: `Fitur Stok Bahan tidak tersedia di paket ${report.plan}. Upgrade ke paket Starter atau lebih tinggi untuk mengelola stok deterjen, parfum, dll.`,
          canTopup: false,
          whatsappBillingNumber: report.whatsappBillingNumber,
        });
      }
      if (report.usage.inventory.isExceeded) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'INVENTORY_LIMIT_EXCEEDED',
          message: `Batas item stok (${report.limits.maxStockItems} item) telah tercapai. Data stok lama tetap bisa dilihat. Upgrade paket untuk menambah jenis item baru.`,
          canTopup: false,
          current: report.usage.inventory.used,
          limit: report.limits.maxStockItems,
          whatsappBillingNumber: report.whatsappBillingNumber,
        });
      }
    }

    return true;
  }

  /**
   * Pembersihan otomatis file foto chat yang telah melewati batas retensi
   */
  async cleanupExpiredPhotos(storeId?: string) {
    if (process.env.ENABLE_PHOTO_RETENTION_CLEANUP !== 'true') {
      return { cleaned: 0 };
    }

    const stores = storeId
      ? [{ id: storeId }]
      : await this.prisma.store.findMany({ select: { id: true } });

    let totalCleaned = 0;
    const allLimits = getPlanLimits();

    for (const s of stores) {
      const sub = await this.getOrCreateSubscription(s.id);
      const limits = allLimits[sub.plan] || allLimits.TRIAL;
      const retentionDays = limits.photoRetentionDays || 30;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const expiredMessages = await this.prisma.message.findMany({
        where: {
          conversation: { storeId: s.id },
          type: 'IMAGE',
          createdAt: { lt: cutoff },
          deletedAt: null,
          imageUrl: { not: null },
        },
      });

      for (const msg of expiredMessages) {
        try {
          if (msg.imageUrl) {
            const filename = msg.imageUrl.split('/').pop() || msg.imageUrl;
            await this.storageService.deleteFile(s.id, filename);
          }
          await this.prisma.message.update({
            where: { id: msg.id },
            data: { deletedAt: new Date(), imageUrl: null },
          });
          totalCleaned++;
        } catch (err) {
          this.logger.error(`Gagal menghapus file foto pesan ${msg.id}: ${err.message}`);
        }
      }
    }

    this.logger.log(`Pembersihan retensi foto selesai. Total ${totalCleaned} foto kadaluarsa dibersihkan.`);
    return { cleaned: totalCleaned };
  }

  /**
   * Top-up kuota tambahan untuk bulan berjalan
   */
  async topupQuota(storeId: string, type: 'TRANSACTIONS' | 'PHOTOS', amount: number) {
    const sub = await this.getOrCreateSubscription(storeId);
    return this.prisma.storeSubscription.update({
      where: { storeId },
      data: {
        topupTransactions: type === 'TRANSACTIONS' ? sub.topupTransactions + amount : undefined,
        topupPhotos: type === 'PHOTOS' ? sub.topupPhotos + amount : undefined,
      },
    });
  }

  /**
   * Perbarui / Upgrade paket langganan
   */
  async updatePlan(storeId: string, plan: SubscriptionPlan, durationMonths = 1) {
    await this.getOrCreateSubscription(storeId);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

    return this.prisma.storeSubscription.update({
      where: { storeId },
      data: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        topupTransactions: 0,
        topupPhotos: 0,
      },
    });
  }
}
