import { db } from '../../db.js';
import bcrypt from 'bcryptjs';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncAllDirtyMasterData, syncUsersToBackend, syncInventoryToBackend, pullOrdersFromBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Hidrasi data dari backend ke IndexedDB lokal saat login di browser/device baru
 */
const hydrateFromBackend = async (data) => {
  const { user, store, settings, products, users, pelanggan, inventory } = data;
  const targetStoreId = store?.id || settings?.storeId || user?.storeId;

  // 1. Simpan / Update Settings & Store
  if (settings || store) {
    const existingSetting = await db.settings.get(1);
    const settingPayload = {
      id: 1,
      storeId: store?.id || settings?.storeId || crypto.randomUUID(),
      storeCode: store?.code || settings?.storeCode || existingSetting?.storeCode || '',
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

    await db.settings.put(settingPayload);
  }

  // 2. Hidrasi semua Users dari Store ke Dexie
  const userList = (users && users.length > 0) ? users : (user ? [user] : []);
  for (const u of userList) {
    if (!u || !u.username) continue;
    let existingUser = null;
    if (u.id) {
      existingUser = await db.users.where('uuid').equals(u.id).first();
    }
    if (!existingUser && u.username) {
      existingUser = await db.users.where('username').equals(u.username).first();
    }
    const userPayload = {
      uuid: u.id || existingUser?.uuid || crypto.randomUUID(),
      storeId: u.storeId || store?.id,
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
      const duplicateUuid = await db.users.where('uuid').equals(userPayload.uuid).first();
      if (duplicateUuid) {
        await db.users.update(duplicateUuid.id, userPayload);
      } else {
        await db.users.add(userPayload);
      }
    }
  }

  // 3. Hidrasi Products
  if (products && products.length > 0) {
    for (const p of products) {
      let existingProd = await db.products.where('uuid').equals(p.id).first();
      if (!existingProd && p.code) {
        existingProd = await db.products.where('code').equals(p.code).first();
      }
      if (!existingProd && p.category && p.name) {
        existingProd = await db.products.filter(item => item.category === p.category && item.name === p.name).first();
      }
      const prodPayload = {
        uuid: p.id,
        storeId: p.storeId || targetStoreId,
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

    // Bersihkan duplikat lokal dan deteksi produk lokal yang belum masuk server
    const allLocalProds = await db.products.toArray();
    const serverProductIds = new Set(products.map(p => p.id));
    let hasMissingServerProducts = false;

    for (const lp of allLocalProds) {
      if (!serverProductIds.has(lp.uuid)) {
        const hasMatchedServer = products.some(p => (p.code && p.code === lp.code) || (p.category === lp.category && p.name === lp.name));
        if (hasMatchedServer && lp.isDirty === 1) {
          // Hapus produk lokal duplikat lama
          await db.products.delete(lp.id);
        } else if (!hasMatchedServer) {
          // Produk ini belum ada di server (misal CUCI LIPAT / CUCI SETRIKA), tandai untuk disinkronkan ke DB
          await db.products.update(lp.id, { isDirty: 1 });
          hasMissingServerProducts = true;
        }
      }
    }

    if (hasMissingServerProducts) {
      syncProductsToBackend(false).catch(err => console.warn('[Hydrate] Sync missing products failed:', err));
    }
  } else if (products && products.length === 0) {
    // Skenario: DB product di PostgreSQL masih KOSONG!
    // Hanya saat database produk di server masih kosong, sync produk default dari Dexie ke backend satu kali saja!
    const localProductCount = await db.products.count();
    if (localProductCount > 0) {
      console.log('[Sync] Produk di server masih kosong. Menginisialisasi produk ke DB...');
      syncProductsToBackend(true).catch(err => console.warn('[Hydrate] Init products failed:', err));
    }
  }

  // 4. Hidrasi Pelanggan
  if (pelanggan && pelanggan.length > 0) {
    for (const pel of pelanggan) {
      let existingPel = await db.pelanggan.where('uuid').equals(pel.id).first();
      if (!existingPel && pel.hp) {
        existingPel = await db.pelanggan.where('hp').equals(pel.hp).first();
      }
      if (!existingPel && pel.nama) {
        existingPel = await db.pelanggan.where('nama').equals(pel.nama).first();
      }
      const pelPayload = {
        uuid: pel.id,
        storeId: pel.storeId || targetStoreId,
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

    // Bersihkan duplikat pelanggan lokal yang HP atau namanya sama tapi masih isDirty: 1
    const allLocalPel = await db.pelanggan.toArray();
    const serverPelIds = new Set(pelanggan.map(p => p.id));
    for (const lp of allLocalPel) {
      if (!serverPelIds.has(lp.uuid) && lp.isDirty === 1) {
        const hasMatchedServer = pelanggan.some(p => (p.hp && p.hp === lp.hp) || p.nama === lp.nama);
        if (hasMatchedServer) {
          await db.pelanggan.delete(lp.id);
        }
      }
    }
  }

  // 5. Hidrasi Inventory
  if (inventory && inventory.length > 0) {
    for (const inv of inventory) {
      let existingInv = null;
      if (inv.id) {
        existingInv = await db.inventory.where('uuid').equals(inv.id).first();
      }
      if (!existingInv && inv.nama) {
        existingInv = await db.inventory.filter(i => i.nama && i.nama.toLowerCase() === inv.nama.toLowerCase()).first();
      }
      const invPayload = {
        uuid: inv.id,
        storeId: inv.storeId || targetStoreId,
        nama: inv.nama,
        stok: Number(inv.stok) || 0,
        qty: Number(inv.qty) || 0,
        unit: inv.unit || null,
        status: inv.status || 'approved',
        createdBy: inv.createdBy || null,
        updatedAt: new Date(inv.updatedAt || new Date()),
        isDirty: 0,
      };
      if (existingInv) {
        await db.inventory.update(existingInv.id, invPayload);
      } else {
        await db.inventory.add(invPayload);
      }
    }
  } else if (inventory && inventory.length === 0) {
    const localInvCount = await db.inventory.count();
    if (localInvCount > 0) {
      console.log('[Sync] Inventory di server masih kosong. Menginisialisasi inventory ke DB...');
      syncInventoryToBackend(true).catch(err => console.warn('[Hydrate] Init inventory failed:', err));
    }
  }
};

export const loginUser = async (username, password, storeCode) => {
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi');
  }

  const cleanStoreCode = storeCode?.trim();
  const cleanUsername = username.trim();

  // 1. Jika online -> Utamakan Login Online ke Backend NestJS untuk verifikasi resmi & hidrasi data DB terbaru
  if (navigator.onLine) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          password,
          storeCode: cleanStoreCode || undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const payload = result.data || result;
        if (payload && payload.user) {
          // Simpan token JWT Bearer dari backend ke storage browser
          const token = payload.token || payload.access_token || payload.user?.token;
          if (token) {
            sessionStorage.setItem('token', token);
            localStorage.setItem('auth_token', token);
          }

          try {
            await hydrateFromBackend(payload);
          } catch (hydrateErr) {
            console.error('[Auth] Error during hydrateFromBackend:', hydrateErr);
          }

          // Ambil kembali user dari Dexie yang sudah terhidrasi
          const freshlySavedUser = await db.users.where('username').equals(cleanUsername).first();
          const finalUser = freshlySavedUser || {
            uuid: payload.user.id,
            username: payload.user.username,
            fullname: payload.user.fullname,
            role: payload.user.role,
            storeId: payload.user.storeId,
            storeCode: payload.user.storeCode,
          };
          if (token) {
            finalUser.token = token;
          }
          // Master data & order sudah sinkron setelah hidrasi.
          syncAllDirtyMasterData(false).catch(err => console.warn('Sync master data failed:', err));
          pullOrdersFromBackend().catch(err => console.warn('Pull orders on login failed:', err));
          return finalUser;
        }
      } else if (response.status === 401 || response.status === 404) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Username, password, atau Kode Toko salah');
      } else {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Gagal login ke server');
      }
    } catch (err) {
      if (err.message && (err.message.includes('salah') || err.message.includes('tidak ditemukan') || err.message.includes('wajib diisi'))) {
        throw err;
      }
      console.warn('[Auth] Online login error:', err.message);
      // Fallback ke login lokal offline jika backend/jaringan bermasalah
    }
  }

  // 2. Fallback: Coba login secara lokal offline jika server offline
  const localUser = await db.users.where('username').equals(username.trim()).first();
  if (localUser && (await bcrypt.compare(password, localUser.password))) {
    const setting = await db.settings.get(1);
    // Jika storeCode diberikan dan berbeda dari storeCode yang tersimpan di setting lokal
    if (!cleanStoreCode || !setting?.storeCode || setting.storeCode.toLowerCase() === cleanStoreCode.toLowerCase()) {
      syncAllDirtyMasterData(false).catch(err => console.warn('Sync master data failed:', err));
      return localUser;
    }
  }

  // 3. Jika offline dan data lokal tidak ada
  if (!localUser) {
    throw new Error('Perangkat/Browser ini belum pernah login dengan akun tersebut. Silakan hubungkan internet terlebih dahulu.');
  }

  throw new Error('Username atau password salah');
};

export const registerUser = async ({ storeCode, fullname, username, password, role = 'owner' }) => {
  if (!storeCode || !fullname || !username || !password) {
    throw new Error('Semua field (Kode Toko, Nama Lengkap, Username, Password) wajib diisi');
  }

  const cleanStoreCode = storeCode.trim();
  const cleanUsername = username.trim();
  const cleanFullname = fullname.trim();
  const normalizedRole = role.toLowerCase().trim();

  // Validasi Frontend Lokal: Cegah jika di lokal sudah ada owner untuk toko tersebut
  const setting = await db.settings.get(1);
  if (normalizedRole === 'owner') {
    const localOwner = await db.users.where('role').equals('owner').first();
    if (localOwner && (!setting?.storeCode || setting.storeCode.toLowerCase() === cleanStoreCode.toLowerCase())) {
      throw new Error(`Toko ini sudah memiliki akun Owner (${localOwner.username}). Hanya boleh 1 Owner per Toko.`);
    }
  }

  const existingLocalUser = await db.users.where('username').equals(cleanUsername).first();
  if (existingLocalUser) {
    throw new Error(`Username "${cleanUsername}" sudah terdaftar.`);
  }

  // Panggil endpoint register di backend untuk validasi resmi
  if (navigator.onLine) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeCode: cleanStoreCode,
        fullname: cleanFullname,
        username: cleanUsername,
        password,
        role: normalizedRole,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || 'Gagal registrasi akun ke backend');
    }

    const result = await response.json();
    const regData = result.data || {};
    const registeredUser = regData.user || regData;
    const token = regData.token || registeredUser.token;
    if (token) {
      sessionStorage.setItem('token', token);
      localStorage.setItem('auth_token', token);
    }

    // Simpan ke Dexie lokal
    const hashedPassword = await bcrypt.hash(password, 10);
    const newId = await db.users.add(withNewSyncMeta({
      uuid: registeredUser.id,
      storeId: registeredUser.storeId,
      fullname: registeredUser.fullname,
      username: registeredUser.username,
      password: hashedPassword,
      role: registeredUser.role,
      isDirty: 0,
    }));

    // Simpan/update store info di db.settings lokal
    if (setting) {
      await db.settings.update(1, {
        storeId: registeredUser.storeId,
        storeCode: registeredUser.storeCode,
        namaLaundry: registeredUser.storeName,
        isDirty: 0,
      });
    } else {
      await db.settings.add({
        id: 1,
        storeId: registeredUser.storeId,
        storeCode: registeredUser.storeCode,
        namaLaundry: registeredUser.storeName,
        isDirty: 0,
      });
    }

    return newId;
  } else {
    throw new Error('Pendaftaran akun membutuhkan koneksi internet untuk memvalidasi Kode Toko.');
  }
};
export const getKasirUsersQuery = async () => {
  const storeId = await getActiveStoreId();
  const kasirList = await db.users.where('role').equals('kasir').toArray();
  const nonDeleted = kasirList.filter(u => !u.deletedAt);
  if (!storeId) return nonDeleted;
  return nonDeleted.filter(u => !u.storeId || u.storeId === storeId);
};

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

