import Dexie from 'dexie';
import { DEFAULT_PLANS } from './db/repositories/plans.constants';

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

// Schema versi 2: indeks storeId untuk multi-tenant per-store scoping
db.version(2).stores({
  users: '++id, &uuid, storeId, username, password, fullname, role, updatedAt, deletedAt, isDirty',
  products: '++id, &uuid, storeId, name, price, updatedAt, deletedAt, isDirty',
  orders: '++id, &uuid, storeId, invoiceId, userId, total, createdAt, pelangganId, diskon, metodeBayar, estimasi, tipeLayanan, isPriority, bayar, kembalian, statusBayar, status, catatan, updatedAt, deletedAt, isDirty',
  pelanggan: '++id, &uuid, storeId, nama, hp, alamat, updatedAt, deletedAt, isDirty',
  inventory: '++id, &uuid, storeId, nama, stok, qty, unit, status, createdBy, createdAt, updatedAt, deletedAt, isDirty',
  inventoryEvents: '++id, &uuid, storeId, inventoryId, type, qty, note, createdBy, createdAt, updatedAt, deletedAt, isDirty',
  chatLog: '++id, &uuid, storeId, intent, status, userId, timestamp, updatedAt, isDirty',
});

// Schema versi 3: Modul Chat (conversations, conversationMembers, messages) + tracking batas offline di settings
db.version(3).stores({
  settings: 'id, updatedAt, isDirty, lastOnlineAt, offlineSince',
  conversations: 'id, uuid, type, title, storeId, lastMessageText, lastMessageAt, updatedAt, isDirty',
  conversationMembers: '++id, conversationId, userId, role, lastReadAt',
  messages: 'id, uuid, conversationId, senderId, senderName, content, type, imageUrl, status, createdAt, updatedAt, isDirty',
});

// Schema versi 4: catatanKasir internal & kasirUsername
db.version(4).stores({
  orders: '++id, &uuid, storeId, invoiceId, userId, kasirUsername, total, createdAt, pelangganId, diskon, metodeBayar, estimasi, tipeLayanan, isPriority, bayar, kembalian, statusBayar, status, catatan, catatanKasir, updatedAt, deletedAt, isDirty',
});

// Schema versi 5: indeks code & category pada tabel products
db.version(5).stores({
  products: '++id, &uuid, storeId, code, category, name, price, updatedAt, deletedAt, isDirty',
});

// Schema versi 6: Master Subscription Plans & Store Subscriptions
db.version(6).stores({
  plans: '&key, name, price, sortOrder, isActive, updatedAt',
  storeSubscriptions: 'id, &storeId, plan, status, updatedAt',
});

// Schema versi 7: Tabel notifikasi
db.version(7).stores({
  notifications: '++id, &uuid, storeId, role, title, message, type, link, isRead, createdAt, isDirty',
});

// Seed initial data if empty
db.on('ready', async () => {
  try {
    // Seed Master Plans jika belum ada
    if (db.plans) {
      const planCount = await db.plans.count();
      if (planCount === 0) {
        await db.plans.bulkPut(DEFAULT_PLANS.map((p) => ({
          ...p,
          updatedAt: new Date(),
        })));
      }
    }

    // Seed Settings
    const sCount = await db.settings.count();
    if (sCount === 0) {
      await db.settings.add({
        id: 1,
        storeId: null,
        deviceId: crypto.randomUUID().substring(0, 4).toUpperCase(),
        namaLaundry: 'KASIR LAUNDRY',
        alamat: 'Jl. Imam Bonjol 007',
        kota: 'KARAWANG',
        telepon: '08888888888',
        jamBuka: '08.00 - 17.00',
        menerimaCucian: true,
        headerStruk: 'Terima kasih atas kunjungan anda',
        footerStruk: 'Kami menerima Cuci Karpet, Bedcover, Boneka, dan Satuan',
        lastInvoiceNumber: 0,
        lastOnlineAt: new Date(),
        offlineSince: null,
        updatedAt: new Date(),
        isDirty: 0
      });
    }

    // Seed Products
    const pCount = await db.products.count();
    if (pCount === 0) {
      const rawProducts = [
        // Cuci Lipat
        { code: 'CLR', category: 'CUCI LIPAT', name: 'Reguler (2-3 hari)', price: 5000 },
        { code: 'CLE', category: 'CUCI LIPAT', name: 'Express (1 Hari)', price: 7000 },
        { code: 'CLP', category: 'CUCI LIPAT', name: 'Pagi Sore (8 Jam)', price: 9000 },
        { code: 'CLK', category: 'CUCI LIPAT', name: 'Kilat (4 Jam)', price: 12000 },

        // Cuci Setrika
        { code: 'CSR', category: 'CUCI SETRIKA', name: 'Reguler (2-3 hari)', price: 6000 },
        { code: 'CSE', category: 'CUCI SETRIKA', name: 'Express (1 Hari)', price: 9000 },
        { code: 'CSP', category: 'CUCI SETRIKA', name: 'Pagi Sore (8 Jam)', price: 11000 },

        // Setrika Saja
        { code: 'SSR', category: 'SETRIKA SAJA', name: 'Reguler (2-3 hari)', price: 5000 },
        { code: 'SSE', category: 'SETRIKA SAJA', name: 'Express (1 Hari)', price: 7000 },
        { code: 'SSP', category: 'SETRIKA SAJA', name: 'Pagi Sore (8 Jam)', price: 9000 },
      ];
      await db.products.bulkAdd(rawProducts.map(p => ({
        ...p,
        uuid: crypto.randomUUID(),
        updatedAt: new Date(),
        isDirty: 1
      })));
    }

    // Seed Inventory dengan UUID unik
    const iCount = await db.inventory.count();
    if (iCount === 0) {
      await db.inventory.add({ uuid: crypto.randomUUID(), nama: 'Plastik', stok: 15, isDirty: 0 });
      await db.inventory.add({ uuid: crypto.randomUUID(), nama: 'Deterjen', stok: 10, isDirty: 0 });
      await db.inventory.add({ uuid: crypto.randomUUID(), nama: 'Molto', stok: 10, isDirty: 0 });
    }

    // Cleanup duplicates
    const inv = await db.inventory.toArray();
    const map = {};
    for (const item of inv) {
      if (!item?.nama) continue;
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
  } catch (err) {
    console.error('[DB] Gagal menjalankan inisialisasi awal database:', err);
  }
});

db.open().catch((err) => {
  console.error('[DB] Gagal membuka IndexedDB:', err);
});
