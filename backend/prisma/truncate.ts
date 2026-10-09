import { Pool } from 'pg';
import 'dotenv/config';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🔄 Membersihkan semua data di database...');

  const query = `
    TRUNCATE TABLE 
      "SyncLog", 
      "OrderItem", 
      "Order", 
      "Pelanggan", 
      "Inventory", 
      "Product", 
      "User", 
      "Settings", 
      "Store" 
    CASCADE;
  `;

  try {
    await pool.query(query);
    console.log('✅ Semua data berhasil dikosongkan! Struktur tabel tetap utuh.');
  } catch (error) {
    console.error('❌ Gagal membersihkan data:', error);
  } finally {
    await pool.end();
  }
}

main();
