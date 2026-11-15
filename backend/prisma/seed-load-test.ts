import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const isClean = process.argv.includes('--clean');

  try {
    if (isClean) {
      console.log('🧹 Menghapus data Load Test dari database...');
      const t0 = Date.now();
      await pool.query(`
        CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
        CREATE INDEX IF NOT EXISTS "Order_pelangganId_idx" ON "Order"("pelangganId");
        CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
        CREATE INDEX IF NOT EXISTS "Conversation_createdById_idx" ON "Conversation"("createdById");
        CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");

        DELETE FROM "Order" WHERE "invoiceId" LIKE 'LT-%';
        DELETE FROM "User" WHERE "username" LIKE 'kasir_lt_%';
        DELETE FROM "Inventory" WHERE "createdBy" = 'loadtest_seed';
        DELETE FROM "Pelanggan" WHERE "nama" LIKE 'Pelanggan LoadTest #%';
      `);
      console.log(`✅ Data Load Test berhasil dibersihkan dalam ${Date.now() - t0} ms.`);
      return;
    }

    console.log('🚀 Menjalankan Bulk Insert Load Test:');
    console.log('   - 1.000 Pelanggan');
    console.log('   - 1.000 Stock (Inventory)');
    console.log('   - 100.000 User');
    console.log('   - 100.000 Order + 100.000 OrderItem');

    const sqlPath = path.join(__dirname, 'seed-load-test.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    const startInsert = Date.now();
    await pool.query(sql);
    const insertMs = Date.now() - startInsert;
    console.log(`✅ Bulk insert selesai dalam ${(insertMs / 1000).toFixed(2)} detik (${insertMs} ms)!`);

    // Benchmark Query Performa di Dev
    const storeRes = await pool.query(`SELECT id, code, name FROM "Store" ORDER BY "createdAt" ASC LIMIT 1`);
    const storeId = storeRes.rows[0]?.id;

    if (storeId) {
      console.log(`\n📊 Benchmark Performa Query pada Store "${storeRes.rows[0].name}" (${storeRes.rows[0].code}):`);

      const q1Start = Date.now();
      const ordersRes = await pool.query(
        `SELECT o.id, o."invoiceId", o.total, o.status, o."createdAt"
         FROM "Order" o
         WHERE o."storeId" = $1 AND o."deletedAt" IS NULL
         ORDER BY o."createdAt" DESC
         LIMIT 500`,
        [storeId],
      );
      console.log(`   1. Fetch 500 Order terbaru (Sync Pull) : ${Date.now() - q1Start} ms (${ordersRes.rowCount} rows)`);

      const q2Start = Date.now();
      const pelRes = await pool.query(
        `SELECT id, nama, hp, alamat FROM "Pelanggan" WHERE "storeId" = $1 AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 1000`,
        [storeId],
      );
      console.log(`   2. Fetch 1.000 Pelanggan               : ${Date.now() - q2Start} ms (${pelRes.rowCount} rows)`);

      const q3Start = Date.now();
      const invRes = await pool.query(
        `SELECT id, nama, stok, qty, unit FROM "Inventory" WHERE "storeId" = $1 AND "deletedAt" IS NULL ORDER BY "updatedAt" DESC LIMIT 1000`,
        [storeId],
      );
      console.log(`   3. Fetch 1.000 Stock (Inventory)       : ${Date.now() - q3Start} ms (${invRes.rowCount} rows)`);

      const q4Start = Date.now();
      const userRes = await pool.query(
        `SELECT id, username, fullname, role FROM "User" WHERE "storeId" = $1 AND username = 'kasir_lt_50000' LIMIT 1`,
        [storeId],
      );
      console.log(`   4. Lookup Login User ke-50.000 (Index) : ${Date.now() - q4Start} ms (${userRes.rowCount} row)`);

      const q5Start = Date.now();
      const trackRes = await pool.query(
        `SELECT id, "invoiceId", status, total FROM "Order" WHERE "invoiceId" = 'LT-050000' AND "deletedAt" IS NULL LIMIT 1`,
      );
      console.log(`   5. Public Track Order by InvoiceId     : ${Date.now() - q5Start} ms (${trackRes.rowCount} row)`);

      const q6Start = Date.now();
      const loginNoStoreRes = await pool.query(
        `SELECT id, "storeId", username FROM "User" WHERE username = 'kasir_lt_88888' AND "deletedAt" IS NULL`,
      );
      console.log(`   6. Login by Username tanpa StoreCode   : ${Date.now() - q6Start} ms (${loginNoStoreRes.rowCount} row)`);
    }
  } catch (err) {
    console.error('❌ Error saat menjalankan Load Test:', err);
  } finally {
    await pool.end();
  }
}

main();

