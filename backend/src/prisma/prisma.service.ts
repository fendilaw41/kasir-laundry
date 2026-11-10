import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing in .env!');
    }
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: '-c timezone=UTC',
    });

    // Cegah crash Node.js jika koneksi idle PostgreSQL terputus
    pool.on('error', (err) => {
      this.logger.error(`PostgreSQL pool client error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database successfully.');
      await this.ensureSchemaIntegrity();
    } catch (error: any) {
      this.logger.error(
        `Prisma database connection error: ${error.message}. Server tetap aktif, namun request ke DB akan mengembalikan status 500 sampai PostgreSQL kembali berjalan.`,
      );
    }
  }

  /**
   * Memastikan integritas tabel & kolom subscription dan master plan di database PostgreSQL dev/prod
   * Mencegah error Prisma P2022 jika migration belum diterapkan di environment database tertentu.
   */
  async ensureSchemaIntegrity() {
    try {
      // 1. Enums
      await this.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'BASIC', 'PRO', 'BUSINESS');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
        DO $$ BEGIN
          CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'GRACE_PERIOD');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
      `);

      // 2. Kolom feature subscription pada tabel Store
      await this.$executeRawUnsafe(`
        ALTER TABLE "Store"
        ADD COLUMN IF NOT EXISTS "featureSubscriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "showUpgradeBanner" BOOLEAN NOT NULL DEFAULT true;
      `);

      // 3. Tabel StoreSubscription beserta seluruh kolom snapshot
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "StoreSubscription" (
          "id" TEXT NOT NULL,
          "storeId" TEXT NOT NULL,
          "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
          "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
          "currentPeriodStart" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "currentPeriodEnd" TIMESTAMPTZ(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
          "topupTransactions" INTEGER NOT NULL DEFAULT 0,
          "topupPhotos" INTEGER NOT NULL DEFAULT 0,
          "maxTransactions" INTEGER NOT NULL DEFAULT 30,
          "usedTransactions" INTEGER NOT NULL DEFAULT 0,
          "remainingTransactions" INTEGER NOT NULL DEFAULT 30,
          "maxChatPhotos" INTEGER NOT NULL DEFAULT 30,
          "usedPhotos" INTEGER NOT NULL DEFAULT 0,
          "remainingPhotos" INTEGER NOT NULL DEFAULT 30,
          "maxUsers" INTEGER NOT NULL DEFAULT 2,
          "usedUsers" INTEGER NOT NULL DEFAULT 1,
          "remainingUsers" INTEGER NOT NULL DEFAULT 1,
          "maxProducts" INTEGER NOT NULL DEFAULT 12,
          "usedProducts" INTEGER NOT NULL DEFAULT 0,
          "remainingProducts" INTEGER NOT NULL DEFAULT 12,
          "maxStockItems" INTEGER NOT NULL DEFAULT 3,
          "usedInventory" INTEGER NOT NULL DEFAULT 0,
          "remainingInventory" INTEGER NOT NULL DEFAULT 3,
          "customBranding" JSONB,
          "notes" TEXT,
          "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
        );

        ALTER TABLE "StoreSubscription"
        ADD COLUMN IF NOT EXISTS "maxTransactions" INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "usedTransactions" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "remainingTransactions" INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "maxChatPhotos" INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "usedPhotos" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "remainingPhotos" INTEGER NOT NULL DEFAULT 30,
        ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS "usedUsers" INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "remainingUsers" INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "maxProducts" INTEGER NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS "usedProducts" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "remainingProducts" INTEGER NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS "maxStockItems" INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "usedInventory" INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "remainingInventory" INTEGER NOT NULL DEFAULT 3;

        CREATE UNIQUE INDEX IF NOT EXISTS "StoreSubscription_storeId_key" ON "StoreSubscription"("storeId");
        CREATE INDEX IF NOT EXISTS "StoreSubscription_storeId_status_idx" ON "StoreSubscription"("storeId", "status");
      `);

      // 4. Tabel MasterPlan
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "MasterPlan" (
          "id" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "price" INTEGER NOT NULL DEFAULT 0,
          "priceLabel" TEXT NOT NULL,
          "isPopular" BOOLEAN NOT NULL DEFAULT false,
          "maxTransactions" INTEGER NOT NULL DEFAULT 30,
          "maxChatPhotos" INTEGER NOT NULL DEFAULT 30,
          "botTransactions" INTEGER NOT NULL DEFAULT 0,
          "maxPdfInvoice" INTEGER NOT NULL DEFAULT 0,
          "customPdfLogo" BOOLEAN NOT NULL DEFAULT false,
          "watermarkTracking" BOOLEAN NOT NULL DEFAULT true,
          "customTrackingView" BOOLEAN NOT NULL DEFAULT false,
          "maxStockItems" INTEGER NOT NULL DEFAULT 3,
          "lowStockNotification" BOOLEAN NOT NULL DEFAULT false,
          "hasStockHistory" BOOLEAN NOT NULL DEFAULT false,
          "maxOutlets" INTEGER NOT NULL DEFAULT 1,
          "maxUsers" INTEGER NOT NULL DEFAULT 2,
          "maxProducts" INTEGER NOT NULL DEFAULT 20,
          "dataHistoryMonths" INTEGER NOT NULL DEFAULT 1,
          "photoRetentionDays" INTEGER NOT NULL DEFAULT 30,
          "supportType" TEXT NOT NULL DEFAULT 'Panduan',
          "badgeColor" TEXT DEFAULT 'secondary',
          "sortOrder" INTEGER NOT NULL DEFAULT 1,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "MasterPlan_pkey" PRIMARY KEY ("id")
        );

        CREATE UNIQUE INDEX IF NOT EXISTS "MasterPlan_key_key" ON "MasterPlan"("key");
        CREATE INDEX IF NOT EXISTS "MasterPlan_sortOrder_isActive_idx" ON "MasterPlan"("sortOrder", "isActive");

        ALTER TABLE "MasterPlan"
        ADD COLUMN IF NOT EXISTS "maxProducts" INTEGER NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS "hasStockHistory" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 2;

        -- Seed default plans jika kosong atau update ke konfigurasi baru
        INSERT INTO "MasterPlan" (
          "id", "key", "name", "price", "priceLabel", "isPopular",
          "maxTransactions", "maxChatPhotos", "botTransactions", "maxPdfInvoice",
          "customPdfLogo", "watermarkTracking", "customTrackingView",
          "maxStockItems", "lowStockNotification", "hasStockHistory", "maxOutlets", "maxUsers", "maxProducts",
          "dataHistoryMonths", "photoRetentionDays", "supportType", "badgeColor", "sortOrder", "isActive", "updatedAt"
        ) VALUES
        ('plan-trial', 'TRIAL', 'Trial (Gratis)', 0, 'Gratis', false, 30, 5, 10, 0, false, true, false, 3, false, false, 1, 2, 12, 1, 30, 'Panduan', 'secondary', 1, true, CURRENT_TIMESTAMP),
        ('plan-starter', 'STARTER', 'Starter', 25000, '25rb/bln', false, 100, 5, 0, 20, false, true, false, 5, false, false, 1, 2, 20, 3, 60, 'Komunitas', 'info', 2, true, CURRENT_TIMESTAMP),
        ('plan-basic', 'BASIC', 'Basic', 50000, '50rb/bln', true, 150, 20, 20, 100, false, false, false, 20, true, true, 1, 3, 50, 6, 90, 'Chat', 'primary', 3, true, CURRENT_TIMESTAMP),
        ('plan-pro', 'PRO', 'Pro', 100000, '100rb/bln', false, 300, 100, 200, -1, false, false, false, 50, true, true, 2, 5, 100, 12, 180, 'Prioritas', 'warning', 4, true, CURRENT_TIMESTAMP),
        ('plan-business', 'BUSINESS', 'Business', 200000, '200rb/bln', false, 1000, 500, 1000, -1, -1, true, false, true, -1, true, true, 5, -1, -1, 24, 365, 'Prioritas + Onboard', 'dark', 5, true, CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO UPDATE SET
          "maxProducts" = EXCLUDED."maxProducts",
          "maxTransactions" = EXCLUDED."maxTransactions",
          "maxChatPhotos" = EXCLUDED."maxChatPhotos",
          "botTransactions" = EXCLUDED."botTransactions",
          "maxUsers" = EXCLUDED."maxUsers",
          "hasStockHistory" = EXCLUDED."hasStockHistory";

        -- Update master plans untuk foto chat dan bot transaksi
        UPDATE "MasterPlan" SET "maxChatPhotos" = 5, "botTransactions" = 10 WHERE "key" = 'TRIAL';
        UPDATE "MasterPlan" SET "maxChatPhotos" = 5, "botTransactions" = 0 WHERE "key" = 'STARTER';
        UPDATE "MasterPlan" SET "maxChatPhotos" = 20, "botTransactions" = 20 WHERE "key" = 'BASIC';
        UPDATE "MasterPlan" SET "maxChatPhotos" = 100, "botTransactions" = 200 WHERE "key" = 'PRO';
        UPDATE "MasterPlan" SET "maxChatPhotos" = 500, "botTransactions" = 1000 WHERE "key" = 'BUSINESS';

        -- Pastikan master plan TRIAL diset ke 12 produk dan STARTER ke 20 produk
        UPDATE "MasterPlan"
        SET "maxProducts" = 12
        WHERE "key" = 'TRIAL';

        UPDATE "MasterPlan"
        SET "maxProducts" = 20
        WHERE "key" = 'STARTER';

        -- Pastikan toko yang terdaftar dengan plan TRIAL kuota produknya 12 dan foto 5
        UPDATE "StoreSubscription"
        SET "maxProducts" = 12,
            "remainingProducts" = GREATEST(0, 12 - "usedProducts"),
            "maxChatPhotos" = 5,
            "remainingPhotos" = GREATEST(0, 5 - "usedPhotos")
        WHERE "plan" = 'TRIAL';

        -- Pastikan toko yang terdaftar dengan plan STARTER kuota produk terupdate ke 20 dan foto 5
        UPDATE "StoreSubscription"
        SET "maxProducts" = 20,
            "remainingProducts" = GREATEST(0, 20 - "usedProducts"),
            "maxChatPhotos" = 5,
            "remainingPhotos" = GREATEST(0, 5 - "usedPhotos")
        WHERE "plan" = 'STARTER';

        -- Tabel Notification & Index
        CREATE TABLE IF NOT EXISTS "Notification" (
          "id" TEXT NOT NULL,
          "storeId" TEXT NOT NULL,
          "userId" TEXT,
          "role" TEXT,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "link" TEXT,
          "isRead" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Notification_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE INDEX IF NOT EXISTS "Notification_storeId_createdAt_idx" ON "Notification"("storeId", "createdAt" DESC);
        CREATE INDEX IF NOT EXISTS "Notification_storeId_role_isRead_idx" ON "Notification"("storeId", "role", "isRead");
      `);

      this.logger.log('Database schema integrity verified successfully.');
    } catch (err: any) {
      this.logger.warn(`Schema integrity check non-critical warning: ${err.message}`);
    }
  }

  /**
   * Cek status koneksi database secara aman tanpa melempar exception
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
