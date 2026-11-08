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
    "customBranding" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
);

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

