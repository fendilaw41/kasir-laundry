-- CreateTable
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
    "maxStockItems" INTEGER NOT NULL DEFAULT 0,
    "lowStockNotification" BOOLEAN NOT NULL DEFAULT false,
    "maxOutlets" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 1,
    "maxProducts" INTEGER NOT NULL DEFAULT 5,
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterPlan_key_key" ON "MasterPlan"("key");
CREATE INDEX IF NOT EXISTS "MasterPlan_sortOrder_isActive_idx" ON "MasterPlan"("sortOrder", "isActive");

-- AlterTable MasterPlan add maxProducts if not exists
ALTER TABLE "MasterPlan"
ADD COLUMN IF NOT EXISTS "maxProducts" INTEGER NOT NULL DEFAULT 5;

-- Seed Default Plans
INSERT INTO "MasterPlan" (
    "id", "key", "name", "price", "priceLabel", "isPopular",
    "maxTransactions", "maxChatPhotos", "botTransactions", "maxPdfInvoice",
    "customPdfLogo", "watermarkTracking", "customTrackingView",
    "maxStockItems", "lowStockNotification", "maxOutlets", "maxUsers", "maxProducts",
    "dataHistoryMonths", "photoRetentionDays", "supportType", "badgeColor", "sortOrder", "isActive", "updatedAt"
) VALUES
('plan-trial', 'TRIAL', 'Trial (Gratis)', 0, 'Gratis', false, 30, 30, 10, 0, false, true, false, 0, false, 1, 1, 5, 1, 30, 'Panduan', 'secondary', 1, true, CURRENT_TIMESTAMP),
('plan-starter', 'STARTER', 'Starter', 25000, '25rb/bln', false, 100, 300, 0, 20, false, true, false, 5, false, 1, 2, 10, 3, 60, 'Komunitas', 'info', 2, true, CURRENT_TIMESTAMP),
('plan-basic', 'BASIC', 'Basic', 50000, '50rb/bln', true, 150, 800, 200, 100, false, false, false, 20, true, 1, 3, 50, 6, 90, 'Chat', 'primary', 3, true, CURRENT_TIMESTAMP),
('plan-pro', 'PRO', 'Pro', 100000, '100rb/bln', false, 300, 2000, 1000, -1, false, false, false, 50, true, 2, 5, 100, 12, 180, 'Prioritas', 'warning', 4, true, CURRENT_TIMESTAMP),
('plan-business', 'BUSINESS', 'Business', 200000, '200rb/bln', false, 1000, 5000, -1, -1, true, false, true, -1, true, 5, 15, -1, 24, 365, 'Prioritas + Onboard', 'dark', 5, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "maxProducts" = EXCLUDED."maxProducts", "maxTransactions" = EXCLUDED."maxTransactions";

