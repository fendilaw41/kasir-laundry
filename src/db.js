import Dexie from 'dexie';

export const db = new Dexie('KasirLaundryDB');

db.version(5).stores({
  users: '++id, username, password, fullname',
  products: '++id, name, price',
  orders: '++id, invoiceId, userId, total, createdAt, pelangganId, diskon, metodeBayar, estimasi, tipeLayanan, isPriority, bayar, kembalian, statusBayar, status, catatan',
  cart: '++id, productId, quantity',
  pelanggan: '++id, nama, hp, alamat',
  inventory: '++id, nama, stok'
});

// Seed initial data if empty
db.on('ready', async () => {
  const pCount = await db.products.count();
  if (pCount === 0) {
    await db.products.bulkAdd([
      // Cuci Lipat Rapi
      { category: 'CUCI LIPAT RAPI', name: 'Reguler (2-3 hari)', price: 5000 },
      { category: 'CUCI LIPAT RAPI', name: 'Express (1 Hari)', price: 7000 },
      { category: 'CUCI LIPAT RAPI', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { category: 'CUCI LIPAT RAPI', name: 'Kilat (4 Jam)', price: 12000 },

      // Cuci Setrika
      { category: 'CUCI SETRIKA', name: 'Reguler (2-3 hari)', price: 6000 },
      { category: 'CUCI SETRIKA', name: 'Express (1 Hari)', price: 9000 },
      { category: 'CUCI SETRIKA', name: 'Pagi Sore (8 Jam)', price: 11000 },
      { category: 'CUCI SETRIKA', name: 'Kilat (4 Jam)', price: 14000 },

      // Setrika Saja
      { category: 'SETRIKA SAJA', name: 'Reguler (2-3 hari)', price: 5000 },
      { category: 'SETRIKA SAJA', name: 'Express (1 Hari)', price: 7000 },
      { category: 'SETRIKA SAJA', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { category: 'SETRIKA SAJA', name: 'Kilat (4 Jam)', price: 12000 },
    ]);
  }

  const iCount = await db.inventory.count();
  if (iCount === 0) {
    await db.inventory.add({ nama: 'Plastik', stok: 8 });
  }
});

db.open();
