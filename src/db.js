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
      { name: 'Cuci Kering', price: 5000 },
      { name: 'Cuci Setrika', price: 7000 },
      { name: 'Setrika Saja', price: 4000 },
      { name: 'Cuci Karpet', price: 15000 },
      { name: 'Cuci Sepatu', price: 20000 },
      { name: 'Cuci Boneka', price: 10000 }
    ]);
  }

  const iCount = await db.inventory.count();
  if (iCount === 0) {
    await db.inventory.add({ nama: 'Plastik', stok: 8 });
  }
});

db.open();
