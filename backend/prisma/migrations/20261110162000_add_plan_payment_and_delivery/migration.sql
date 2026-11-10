-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanPaymentStatus') THEN
        CREATE TYPE "PlanPaymentStatus" AS ENUM ('NOT_PAID', 'PAID', 'EXPIRED', 'FAILED');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlanPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "PlanPaymentStatus" NOT NULL DEFAULT 'NOT_PAID',
    "mayarInvoiceId" TEXT,
    "mayarTransactionId" TEXT,
    "paymentUrl" TEXT,
    "qrString" TEXT,
    "vaNumber" TEXT,
    "vaBank" TEXT,
    "customerName" TEXT,
    "expiredAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "lastCheckedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentDelivery" (
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "lastError" TEXT,
    "lockedUntil" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentDelivery_pkey" PRIMARY KEY ("transactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlanPayment_orderId_key" ON "PlanPayment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlanPayment_mayarTransactionId_key" ON "PlanPayment"("mayarTransactionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanPayment_storeId_status_idx" ON "PlanPayment"("storeId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlanPayment_orderId_idx" ON "PlanPayment"("orderId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PlanPayment_storeId_fkey'
    ) THEN
        ALTER TABLE "PlanPayment" ADD CONSTRAINT "PlanPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

