import Dexie from 'dexie';

export const db = new Dexie('KasirLaundryDB');

// Schema versi 1: offline-first sync ready (dengan UUID, updatedAt, deletedAt, isDirty)
// + tabel inventoryEvents untuk event-sourcing stok
db.version(1).stores({
  users: '++id, &uuid, username, password, fullname, role, updatedAt, deletedAt, isDirty',
  products: '++id, &uuid, name, price, updatedAt, deletedAt, isDirty',
  orders: '++id, &uuid, invoiceId, userId, total, createdAt, pelangganId, diskon, metodeBayar, estimasi, tipeLayanan, isPriority, bayar, kembalian, statusBayar, status, catatan, updatedAt, deletedAt, isDirty',
  cart: '++id, &uuid, productId, quantity, updatedAt, isDirty',
  pelanggan: '++id, &uuid, nama, hp, alamat, updatedAt, deletedAt, isDirty',
  inventory: '++id, &uuid, nama, stok, qty, unit, status, createdBy, createdAt, updatedAt, deletedAt, isDirty',
  inventoryEvents: '++id, &uuid, inventoryId, type, qty, note, createdBy, createdAt, updatedAt, deletedAt, isDirty',
  settings: 'id, updatedAt, isDirty',
  chatLog: '++id, &uuid, intent, status, userId, timestamp, updatedAt, isDirty',
  draftOrder: 'id'
});

// Seed initial data if empty
db.on('ready', async () => {
  // Seed Settings
  const sCount = await db.settings.count();
  if (sCount === 0) {
    await db.settings.add({
      id: 1,
      deviceId: crypto.randomUUID().substring(0, 4).toUpperCase(),
      namaLaundry: 'KEENAN LAUNDRY',
      alamat: 'Jl. Imam Bonjol 007',
      kota: 'KARAWANG',
      telepon: '087853131099',
      jamBuka: '08.00 - 17.00',
      menerimaCucian: true,
      headerStruk: 'Terima kasih atas kunjungan anda',
      footerStruk: 'Kami menerima Cuci Karpet, Bedcover, Boneka, dan Satuan\nkasirlaundry.my.id',
      lastInvoiceNumber: 0
    });
  }
  const pCount = await db.products.count();
  if (pCount === 0) {
    await db.products.bulkAdd([
      // Cuci Lipat
      { code: 'CLR', category: 'CUCI LIPAT', name: 'Reguler (2-3 hari)', price: 5000 },
      { code: 'CLE', category: 'CUCI LIPAT', name: 'Express (1 Hari)', price: 7000 },
      { code: 'CLP', category: 'CUCI LIPAT', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { code: 'CLK', category: 'CUCI LIPAT', name: 'Kilat (4 Jam)', price: 12000 },

      // Cuci Setrika
      { code: 'CSR', category: 'CUCI SETRIKA', name: 'Reguler (2-3 hari)', price: 6000 },
      { code: 'CSE', category: 'CUCI SETRIKA', name: 'Express (1 Hari)', price: 9000 },
      { code: 'CSP', category: 'CUCI SETRIKA', name: 'Pagi Sore (8 Jam)', price: 11000 },
      { code: 'CSK', category: 'CUCI SETRIKA', name: 'Kilat (4 Jam)', price: 14000 },

      // Setrika Saja
      { code: 'SSR', category: 'SETRIKA SAJA', name: 'Reguler (2-3 hari)', price: 5000 },
      { code: 'SSE', category: 'SETRIKA SAJA', name: 'Express (1 Hari)', price: 7000 },
      { code: 'SSP', category: 'SETRIKA SAJA', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { code: 'SSK', category: 'SETRIKA SAJA', name: 'Kilat (4 Jam)', price: 12000 },
    ]);
  }

  const iCount = await db.inventory.count();
  if (iCount === 0) {
    await db.inventory.add({ nama: 'Plastik', stok: 15 });
    await db.inventory.add({ nama: 'Deterjen', stok: 10 });
    await db.inventory.add({ nama: 'Molto', stok: 10 });
  }

  // Cleanup duplicates
  const inv = await db.inventory.toArray();
  const map = {};
  for (const item of inv) {
    const key = item.nama.toLowerCase().trim();
    if (map[key]) {
      // Merge into map[key]
      await db.inventory.update(map[key].id, {
        stok: (map[key].stok || 0) + (item.stok || 0),
        qty: (map[key].qty || 0) + (item.qty || 0)
      });
      await db.inventory.delete(item.id);
      map[key].stok = (map[key].stok || 0) + (item.stok || 0);
      map[key].qty = (map[key].qty || 0) + (item.qty || 0);
    } else {
      map[key] = item;
    }
  }
});

db.open();
