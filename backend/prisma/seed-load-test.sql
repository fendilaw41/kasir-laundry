-- =============================================================================
-- LOAD TEST BULK INSERT QUERY (PostgreSQL)
-- Target:
--   1. Pelanggan : 1.000 data
--   2. Inventory : 1.000 data (Stock)
--   3. User      : 100.000 data
--   4. Order     : 100.000 data (+ 100.000 OrderItem)
--
-- Cara menjalankan via psql:
--   psql -d <nama_database> -f backend/prisma/seed-load-test.sql
-- =============================================================================

BEGIN;

-- Pastikan ekstensi pgcrypto aktif untuk gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Pastikan composite indexes untuk performa tinggi pada 100rb+ baris tersedia
CREATE INDEX IF NOT EXISTS "User_username_idx" ON "User"("username");
CREATE INDEX IF NOT EXISTS "User_storeId_role_idx" ON "User"("storeId", "role");
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_createdAt_idx" ON "Pelanggan"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_hp_idx" ON "Pelanggan"("storeId", "hp");
CREATE INDEX IF NOT EXISTS "Pelanggan_storeId_nama_idx" ON "Pelanggan"("storeId", "nama");
CREATE INDEX IF NOT EXISTS "Order_invoiceId_idx" ON "Order"("invoiceId");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_pelangganId_idx" ON "Order"("pelangganId");
CREATE INDEX IF NOT EXISTS "Order_storeId_createdAt_idx" ON "Order"("storeId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Conversation_createdById_idx" ON "Conversation"("createdById");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

DO $$
DECLARE
  v_store_id TEXT;
  v_product_id TEXT;
  -- Hash bcrypt untuk password "password123"
  v_default_password_hash TEXT := '$2b$10$EpRnTzVlqHNP0.fUbXUwSOyuiXe/QLSUG6xNekdHgTGmrpHEfIoxm';
BEGIN
  -- 0. Ambil store pertama yang sudah ada, atau buat store khusus load-test jika kosong
  SELECT id INTO v_store_id FROM "Store" ORDER BY "createdAt" ASC LIMIT 1;

  IF v_store_id IS NULL THEN
    v_store_id := gen_random_uuid()::TEXT;
    INSERT INTO "Store" (
      "id", "code", "name", "address", "city", "phone",
      "featureSubscriptionEnabled", "showUpgradeBanner", "createdAt", "updatedAt"
    ) VALUES (
      v_store_id, 'LOAD01', 'Laundry Load Test', 'Jl. Uji Performa No. 1', 'Jakarta', '081200000000',
      true, true, NOW(), NOW()
    );
  END IF;

  -- Pastikan minimal ada 1 produk untuk relasi OrderItem
  SELECT id INTO v_product_id FROM "Product" WHERE "storeId" = v_store_id AND "deletedAt" IS NULL LIMIT 1;
  IF v_product_id IS NULL THEN
    v_product_id := gen_random_uuid()::TEXT;
    INSERT INTO "Product" (
      "id", "storeId", "code", "category", "name", "price", "createdAt", "updatedAt"
    ) VALUES (
      v_product_id, v_store_id, 'CL-REG', 'CUCI LIPAT', 'Cuci Lipat Reguler (3 Hari)', 7000, NOW(), NOW()
    );
  END IF;

  RAISE NOTICE 'Menggunakan Store ID: %', v_store_id;

  -- ===========================================================================
  -- 1. INSERT 1.000 DATA PELANGGAN
  -- ===========================================================================
  INSERT INTO "Pelanggan" (
    "id", "storeId", "nama", "hp", "alamat", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid()::TEXT,
    v_store_id,
    'Pelanggan LoadTest #' || gs,
    '0812' || LPAD(gs::TEXT, 8, '0'),
    'Jl. Pelanggan Raya Blok ' || ((gs % 50) + 1) || ' No. ' || gs,
    NOW() - (gs || ' minutes')::INTERVAL,
    NOW()
  FROM generate_series(1, 1000) AS gs;

  RAISE NOTICE '1.000 Pelanggan berhasil di-insert.';

  -- ===========================================================================
  -- 2. INSERT 1.000 DATA STOCK (INVENTORY)
  -- ===========================================================================
  INSERT INTO "Inventory" (
    "id", "storeId", "nama", "stok", "qty", "unit", "status", "createdBy", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid()::TEXT,
    v_store_id,
    'Item Stok Laundry #' || gs,
    (gs % 200) + 10,
    (gs % 200) + 10,
    (ARRAY['Liter', 'Kg', 'Botol', 'Pack', 'Pcs'])[(gs % 5) + 1],
    'approved',
    'loadtest_seed',
    NOW() - (gs || ' minutes')::INTERVAL,
    NOW()
  FROM generate_series(1, 1000) AS gs;

  RAISE NOTICE '1.000 Stock (Inventory) berhasil di-insert.';

  -- ===========================================================================
  -- 3. INSERT 100.000 DATA USER (KASIR)
  -- ===========================================================================
  INSERT INTO "User" (
    "id", "storeId", "username", "password", "fullname", "role", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid()::TEXT,
    v_store_id,
    'kasir_lt_' || gs,
    v_default_password_hash,
    'Kasir LoadTest ' || gs,
    'kasir',
    NOW() - (gs || ' seconds')::INTERVAL,
    NOW()
  FROM generate_series(1, 100000) AS gs
  ON CONFLICT ("storeId", "username") DO NOTHING;

  RAISE NOTICE '100.000 User berhasil di-insert.';

  -- ===========================================================================
  -- 4. INSERT 100.000 DATA ORDER + ORDER ITEM
  -- ===========================================================================
  WITH inserted_orders AS (
    INSERT INTO "Order" (
      "id",
      "storeId",
      "invoiceId",
      "total",
      "diskon",
      "bayar",
      "kembalian",
      "metodeBayar",
      "estimasi",
      "tipeLayanan",
      "isPriority",
      "statusBayar",
      "status",
      "catatan",
      "catatanKasir",
      "inventoryUsed",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::TEXT,
      v_store_id,
      'LT-' || LPAD(gs::TEXT, 6, '0'),
      ROUND(((1 + (gs % 5) * 0.5) * 7000))::INT,
      0,
      ROUND(((1 + (gs % 5) * 0.5) * 7000))::INT,
      0,
      (ARRAY['Cash', 'QRIS', 'Transfer'])[(gs % 3) + 1],
      '3',
      (ARRAY['Datang Langsung', 'Antar Jemput'])[(gs % 2) + 1],
      (gs % 10 = 0),
      (ARRAY['Lunas', 'Belum Lunas'])[(gs % 2) + 1],
      (ARRAY['Proses', 'Selesai', 'Ambil'])[(gs % 3) + 1],
      'Catatan pelanggan #' || gs,
      NULL,
      '[]'::JSONB,
      NOW() - ((gs * 5) || ' minutes')::INTERVAL,
      NOW() - ((gs * 5) || ' minutes')::INTERVAL
    FROM generate_series(1, 100000) AS gs
    ON CONFLICT ("storeId", "invoiceId") DO NOTHING
    RETURNING "id", "total", "createdAt", "updatedAt"
  )
  INSERT INTO "OrderItem" (
    "id",
    "orderId",
    "productId",
    "name",
    "quantity",
    "price",
    "subtotal",
    "createdAt",
    "updatedAt"
  )
  SELECT
    gen_random_uuid()::TEXT,
    io."id",
    v_product_id,
    'CUCI LIPAT - Cuci Lipat Reguler (3 Hari)',
    ROUND((io."total"::NUMERIC / 7000.0), 2)::DOUBLE PRECISION,
    7000,
    io."total",
    io."createdAt",
    io."updatedAt"
  FROM inserted_orders io;

  RAISE NOTICE '100.000 Order + 100.000 OrderItem berhasil di-insert.';
END $$;

COMMIT;

-- =============================================================================
-- OPSIONAL: QUERY CLEANUP DATA LOAD TEST (Jalankan manual jika ingin menghapus)
-- =============================================================================
-- DELETE FROM "Order" WHERE "invoiceId" LIKE 'LT-%';
-- DELETE FROM "User" WHERE "username" LIKE 'kasir_lt_%';
-- DELETE FROM "Inventory" WHERE "createdBy" = 'loadtest_seed';
-- DELETE FROM "Pelanggan" WHERE "nama" LIKE 'Pelanggan LoadTest #%';

