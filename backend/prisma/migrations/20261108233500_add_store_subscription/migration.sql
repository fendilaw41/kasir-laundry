-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'STARTER', 'BASIC', 'PRO', 'BUSINESS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'GRACE_PERIOD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "StoreSubscription" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMPTZ(3) NOT NULL,
    "topupTransactions" INTEGER NOT NULL DEFAULT 0,
    "topupPhotos" INTEGER NOT NULL DEFAULT 0,
    "maxTransactions" INTEGER NOT NULL DEFAULT 30,
    "usedTransactions" INTEGER NOT NULL DEFAULT 0,
    "remainingTransactions" INTEGER NOT NULL DEFAULT 30,
    "maxChatPhotos" INTEGER NOT NULL DEFAULT 30,
    "usedPhotos" INTEGER NOT NULL DEFAULT 0,
    "remainingPhotos" INTEGER NOT NULL DEFAULT 30,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "usedUsers" INTEGER NOT NULL DEFAULT 1,
    "remainingUsers" INTEGER NOT NULL DEFAULT 0,
    "maxStockItems" INTEGER NOT NULL DEFAULT 0,
    "usedInventory" INTEGER NOT NULL DEFAULT 0,
    "remainingInventory" INTEGER NOT NULL DEFAULT 0,
    "customBranding" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
);

-- AlterTable StoreSubscription add quota and limit columns (jika tabel sudah pernah dibuat sebelumnya)
ALTER TABLE "StoreSubscription"
ADD COLUMN IF NOT EXISTS "maxTransactions" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "usedTransactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingTransactions" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "maxChatPhotos" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "usedPhotos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingPhotos" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "usedUsers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "remainingUsers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "maxStockItems" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "usedInventory" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "remainingInventory" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoreSubscription_storeId_key" ON "StoreSubscription"("storeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StoreSubscription_storeId_status_idx" ON "StoreSubscription"("storeId", "status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "StoreSubscription" ADD CONSTRAINT "StoreSubscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

