import { db } from '../../db.js';
import bcrypt from 'bcryptjs';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncAllDirtyMasterData, syncUsersToBackend } from '../../services/syncService.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Hidrasi data dari backend ke IndexedDB lokal saat login di browser/device baru
 */
const hydrateFromBackend = async (data) => {
  const { user, store, settings, products, users, pelanggan, inventory } = data;

  // 1. Simpan / Update Settings & Store
  if (settings || store) {
    const existingSetting = await db.settings.get(1);
    const settingPayload = {
      id: 1,
      storeId: store?.id || settings?.storeId || crypto.randomUUID(),
      deviceId: existingSetting?.deviceId || crypto.randomUUID().substring(0, 4).toUpperCase(),
      namaLaundry: settings?.namaLaundry || store?.name || 'Laundry Store',
      motto: settings?.motto || '',
      alamat: settings?.alamat || store?.address || '',
      kota: settings?.kota || store?.city || '',
      telepon: settings?.telepon || store?.phone || '',
      jamBuka: settings?.jamBuka || '08.00 - 17.00',
      menerimaCucian: typeof settings?.menerimaCucian === 'boolean' ? settings.menerimaCucian : true,
      headerStruk: settings?.headerStruk || 'Terima kasih atas kunjungan anda',
      footerStruk: settings?.footerStruk || 'kasirlaundry.my.id',
      lastInvoiceNumber: existingSetting?.lastInvoiceNumber || 0,
      updatedAt: new Date(settings?.updatedAt || new Date()),
      isDirty: 0,
    };

    if (existingSetting) {
      await db.settings.update(1, settingPayload);
    } else {
      await db.settings.add(settingPayload);
    }
  }

  // 2. Hidrasi semua Users dari Store ke Dexie
  if (users && users.length > 0) {
    for (const u of users) {
      const existingUser = await db.users.where('username').equals(u.username).first();
      const userPayload = {
        uuid: u.id,
        storeId: u.storeId,
        username: u.username,
        password: u.password,
        fullname: u.fullname || u.username,
        role: u.role || 'kasir',
        updatedAt: new Date(u.updatedAt || new Date()),
        isDirty: 0,
      };

      if (existingUser) {
        await db.users.update(existingUser.id, userPayload);
      } else {
        await db.users.add(userPayload);
      }
    }
  } else if (user) {
    const existingUser = await db.users.where('username').equals(user.username).first();
    const userPayload = {
      uuid: user.id,
      storeId: user.storeId,
      username: user.username,
      password: user.password,
      fullname: user.fullname || user.username,
      role: user.role || 'kasir',
      updatedAt: new Date(),
      isDirty: 0,
    };
    if (existingUser) {
      await db.users.update(existingUser.id, userPayload);
    } else {
      await db.users.add(userPayload);
    }
  }

  // 3. Hidrasi Products
  if (products && products.length > 0) {
    for (const p of products) {
      const existingProd = await db.products.where('uuid').equals(p.id).first();
      const prodPayload = {
        uuid: p.id,
        code: p.code || null,
        category: p.category || null,
        name: p.name,
        price: Number(p.price) || 0,
        updatedAt: new Date(p.updatedAt || new Date()),
        isDirty: 0,
      };
      if (existingProd) {
        await db.products.update(existingProd.id, prodPayload);
      } else {
        await db.products.add(prodPayload);
      }
    }
  }

  // 4. Hidrasi Pelanggan
  if (pelanggan && pelanggan.length > 0) {
    for (const pel of pelanggan) {
      const existingPel = await db.pelanggan.where('uuid').equals(pel.id).first();
      const pelPayload = {
        uuid: pel.id,
        nama: pel.nama,
        hp: pel.hp,
        alamat: pel.alamat,
        updatedAt: new Date(pel.updatedAt || new Date()),
        isDirty: 0,
      };
      if (existingPel) {
        await db.pelanggan.update(existingPel.id, pelPayload);
      } else {
        await db.pelanggan.add(pelPayload);
      }
    }
  }

  // 5. Hidrasi Inventory
  if (inventory && inventory.length > 0) {
    for (const inv of inventory) {
      const existingInv = await db.inventory.where('uuid').equals(inv.id).first();
      const invPayload = {
        uuid: inv.id,
        nama: inv.nama,
        stok: inv.stok,
        qty: inv.qty,
        unit: inv.unit,
        status: inv.status,
        updatedAt: new Date(inv.updatedAt || new Date()),
        isDirty: 0,
      };
      if (existingInv) {
        await db.inventory.update(existingInv.id, invPayload);
      } else {
        await db.inventory.add(invPayload);
      }
    }
  }
};

export const loginUser = async (username, password) => {
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi');
  }

  // 1. Coba login secara lokal offline terlebih dahulu
  const localUser = await db.users.where('username').equals(username).first();
  if (localUser && (await bcrypt.compare(password, localUser.password))) {
    // Jalankan sync master data di background agar produk & pelanggan lokal terdorong ke backend
    syncAllDirtyMasterData(true).catch(err => console.warn('Sync master data failed:', err));
    return localUser;
  }

  // 2. Jika di lokal tidak ada / password tidak cocok, dan browser online -> coba Login Online ke Backend NestJS
  if (navigator.onLine) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.data) {
          await hydrateFromBackend(result.data);
          // Ambil kembali user dari Dexie yang sudah terhidrasi
          const freshlySavedUser = await db.users.where('username').equals(username).first();
          const finalUser = freshlySavedUser || {
            uuid: result.data.user.id,
            username: result.data.user.username,
            fullname: result.data.user.fullname,
            role: result.data.user.role,
            storeId: result.data.user.storeId,
          };
          syncAllDirtyMasterData(true).catch(err => console.warn('Sync master data failed:', err));
          return finalUser;
        }
      } else if (response.status === 401) {
        throw new Error('Username atau password salah');
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Gagal login ke server');
      }
    } catch (err) {
      if (err.message && err.message.includes('Username atau password salah')) {
        throw err;
      }
      console.warn('[Auth] Online login error:', err.message);
      // Jika error network/server down dan user ada di lokal
      if (localUser) {
        throw new Error('Username atau password salah');
      }
      throw new Error(err.message || 'Gagal terhubung ke server backend.');
    }
  }

  // 3. Jika offline dan data lokal tidak ada
  if (!localUser) {
    throw new Error('Perangkat/Browser ini belum pernah login dengan akun tersebut. Silakan hubungkan internet terlebih dahulu.');
  }

  throw new Error('Username atau password salah');
};

export const registerUser = async ({ fullname, username, password, role = 'owner' }) => {
  if (!fullname || !username || !password) {
    throw new Error('Semua field wajib diisi');
  }

  const existing = await db.users.where('username').equals(username).first();
  if (existing) {
    throw new Error('Username sudah terdaftar');
  }

  // Ambil storeId yang sudah ada di settings, atau generate baru saat pertama kali register
  let setting = await db.settings.get(1);
  let storeId = setting?.storeId;
  if (!storeId) {
    storeId = crypto.randomUUID();
    if (setting) {
      await db.settings.update(1, { storeId, isDirty: 1 });
    } else {
      await db.settings.add({ id: 1, storeId, isDirty: 1 });
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newId = await db.users.add(withNewSyncMeta({ fullname, username, password: hashedPassword, role, storeId }));

  // Trigger sync master data (Settings & User) ke backend secara asynchronous
  syncAllDirtyMasterData().catch(err => console.warn('Sync master data failed:', err));

  return newId;
};
export const getKasirUsersQuery = () => db.users.where('role').equals('kasir').toArray();

export const addUser = async (userData) => {
  return registerUser(userData);
};

export const updateUser = async (id, userData) => {
  const { password, ...rest } = userData;
  const updateData = { ...rest };

  // Only update password if it's less than 60 chars (meaning it's a new plaintext password, not a bcrypt hash)
  if (password && password.length < 60) {
    updateData.password = await bcrypt.hash(password, 10);
  } else if (password && password.length === 60) {
    updateData.password = password; // keep existing hash
  }

  const result = await db.users.update(id, withUpdatedSyncMeta(updateData));

  // Trigger sync user ke backend secara asynchronous
  syncUsersToBackend().catch(err => console.warn('Sync update user failed:', err));

  return result;
};

export const deleteUser = async (id) => {
  // Soft delete: tandai deletedAt supaya penghapusan ikut ter-sync ke backend (tombstone),
  // bukan hard delete yang tidak bisa disinkronkan.
  const result = await db.users.update(id, withUpdatedSyncMeta({ deletedAt: new Date() }));

  // Trigger sync user ke backend secara asynchronous
  syncUsersToBackend().catch(err => console.warn('Sync delete user failed:', err));

  return result;
};

