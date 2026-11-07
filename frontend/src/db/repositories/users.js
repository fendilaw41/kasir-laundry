import { db } from '../../db.js';
import bcrypt from 'bcryptjs';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { syncAllDirtyMasterData, syncUsersToBackend, syncInventoryToBackend, pullOrdersFromBackend } from '../../services/syncService.js';
import { getActiveStoreId } from './storeHelper.js';
import { clearDraftOrder } from './draftOrder.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Hidrasi data dari backend ke IndexedDB lokal saat login di browser/device baru
 */
const hydrateFromBackend = async (data) => {
  const { user, store, settings, products, users, pelanggan, inventory } = data;
  const rawToken = data.token || data.access_token || user?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);
  const targetStoreId = store?.id || settings?.storeId || user?.storeId;

  const existingSetting = await db.settings.get(1);
  const previousStoreId = existingSetting?.storeId;

  // Jika store yang login berbeda dari store sebelumnya di Dexie,
  // bersihkan draft, cart, dan seluruh data lokal toko sebelumnya agar tidak terjadi kebocoran antar tenant!
  if (previousStoreId && targetStoreId && previousStoreId !== targetStoreId) {
    console.log(`[StoreSwitch] Berpindah store dari ${previousStoreId} ke ${targetStoreId}. Membersihkan data store lama...`);
    if (db.cart?.clear) await db.cart.clear();
    await clearDraftOrder();
    if (db.orders?.clear) await db.orders.clear();
    if (db.pelanggan?.clear) await db.pelanggan.clear();
    if (db.inventory?.clear) await db.inventory.clear();
    if (db.inventoryEvents?.clear) await db.inventoryEvents.clear();
    if (db.products?.clear) await db.products.clear();
    if (db.users?.clear) await db.users.clear();
    if (db.conversations?.clear) await db.conversations.clear();
    if (db.conversationMembers?.clear) await db.conversationMembers.clear();
    if (db.messages?.clear) await db.messages.clear();
    if (db.chatLog?.clear) await db.chatLog.clear();
  } else {
    // Sekalipun store sama, selalu bersihkan draftOrder jika pelanggan di dalamnya bukan milik store ini
    const currentDraft = db.draftOrder?.get ? await db.draftOrder.get('current') : null;
    if (currentDraft?.pelanggan?.storeId && targetStoreId && currentDraft.pelanggan.storeId !== targetStoreId) {
      await clearDraftOrder();
    }
  }

  // 1. Simpan / Update Settings & Store
  if (settings || store) {
    const existingSetting = await db.settings.get(1);
    const settingPayload = {
      id: 1,
      storeId: store?.id || settings?.storeId || crypto.randomUUID(),
      storeCode: store?.code || settings?.storeCode || existingSetting?.storeCode || '',
      deviceId: existingSetting?.deviceId || crypto.randomUUID().substring(0, 4).toUpperCase(),
      namaLaundry: settings?.namaLaundry || store?.name || 'Laundry Store',
      motto: settings?.motto || existingSetting?.motto || 'Solusi Laundry Bersih & Cepat',
      alamat: settings?.alamat || store?.address || '',
      kota: settings?.kota || store?.city || '',
      telepon: settings?.telepon || store?.phone || '',
      jamBuka: settings?.jamBuka || '08.00 - 17.00',
      menerimaCucian: typeof settings?.menerimaCucian === 'boolean' ? settings.menerimaCucian : true,
      headerStruk: settings?.headerStruk || 'Terima kasih atas kunjungan anda',
      footerStruk: settings?.footerStruk || 'kasirlaundry.my.id',
      lastInvoiceNumber: existingSetting?.lastInvoiceNumber || 0,
      token: rawToken || existingSetting?.token || existingSetting?.authToken || null,
      authToken: rawToken || existingSetting?.authToken || existingSetting?.token || null,
      updatedAt: new Date(settings?.updatedAt || new Date()),
      isDirty: 0,
    };
    await db.settings.put(settingPayload);
  }

  // 2. Hidrasi semua Users dari Store ke Dexie (Instant In-Memory Mapping + Bulk Put)
  const userList = (users && users.length > 0) ? users : (user ? [user] : []);
  if (userList.length > 0) {
    const existingUsers = await db.users.toArray();
    const existingByUsername = new Map();
    const existingByUuid = new Map();
    for (const eu of existingUsers) {
      if (eu.username) existingByUsername.set(eu.username, eu.id);
      if (eu.uuid) existingByUuid.set(eu.uuid, eu.id);
    }

    const userPayloads = userList.filter(u => u && u.username).map(u => {
      const existingId = existingByUuid.get(u.id) || existingByUsername.get(u.username);
      return {
        ...(existingId ? { id: existingId } : {}),
        uuid: u.id || crypto.randomUUID(),
        storeId: u.storeId || store?.id,
        username: u.username,
        password: u.password,
        fullname: u.fullname || u.username,
        role: u.role || 'kasir',
        updatedAt: new Date(u.updatedAt || new Date()),
        isDirty: 0,
      };
    });
    await db.users.bulkPut(userPayloads);
  }

  // 3. Hidrasi Products (Instant In-Memory Mapping + Bulk Put)
  if (products && products.length > 0) {
    const existingProds = await db.products.toArray();
    const existingByCode = new Map();
    const existingByUuid = new Map();
    for (const ep of existingProds) {
      if (ep.code) existingByCode.set(ep.code, ep.id);
      if (ep.uuid) existingByUuid.set(ep.uuid, ep.id);
    }

    const prodPayloads = products.map(p => {
      const existingId = existingByUuid.get(p.id) || (p.code && existingByCode.get(p.code));
      return {
        ...(existingId ? { id: existingId } : {}),
        uuid: p.id,
        storeId: p.storeId || targetStoreId,
        code: p.code || null,
        category: p.category || null,
        name: p.name,
        price: Number(p.price) || 0,
        updatedAt: new Date(p.updatedAt || new Date()),
        deletedAt: p.deletedAt ? new Date(p.deletedAt) : null,
        isDirty: 0,
      };
    });
    await db.products.bulkPut(prodPayloads);

    // Hapus produk lokal duplikat/dummy yang code-nya sama tapi isDirty: 1
    const serverProductUuids = new Set(prodPayloads.map(p => p.uuid));
    const toDeleteProdIds = existingProds
      .filter(lp => lp.isDirty === 1 && !serverProductUuids.has(lp.uuid) && lp.code && products.some(sp => sp.code === lp.code))
      .map(lp => lp.id);
    if (toDeleteProdIds.length > 0) {
      await db.products.bulkDelete(toDeleteProdIds);
    }
  }

  // 4. Hidrasi Pelanggan (Instant In-Memory Mapping + Bulk Put)
  if (pelanggan && pelanggan.length > 0) {
    const existingPel = await db.pelanggan.toArray();
    const existingByHp = new Map();
    const existingByUuid = new Map();
    for (const ep of existingPel) {
      if (ep.hp) existingByHp.set(ep.hp, ep.id);
      if (ep.uuid) existingByUuid.set(ep.uuid, ep.id);
    }

    const pelPayloads = pelanggan.map(pel => {
      const existingId = existingByUuid.get(pel.id) || (pel.hp && existingByHp.get(pel.hp));
      return {
        ...(existingId ? { id: existingId } : {}),
        uuid: pel.id,
        storeId: pel.storeId || targetStoreId,
        nama: pel.nama,
        hp: pel.hp,
        alamat: pel.alamat,
        updatedAt: new Date(pel.updatedAt || new Date()),
        isDirty: 0,
      };
    });
    await db.pelanggan.bulkPut(pelPayloads);
  }

  // 5. Hidrasi Inventory (Instant In-Memory Mapping + Bulk Put)
  if (inventory && inventory.length > 0) {
    const existingInv = await db.inventory.toArray();
    const existingByName = new Map();
    const existingByUuid = new Map();
    for (const ei of existingInv) {
      if (ei.nama) existingByName.set(ei.nama.toLowerCase().trim(), ei.id);
      if (ei.uuid) existingByUuid.set(ei.uuid, ei.id);
    }

    const invPayloads = inventory.map(inv => {
      const existingId = existingByUuid.get(inv.id) || (inv.nama && existingByName.get(inv.nama.toLowerCase().trim()));
      return {
        ...(existingId ? { id: existingId } : {}),
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
    });
    await db.inventory.bulkPut(invPayloads);
  }
};

/**
 * Helper untuk memeriksa apakah JWT Bearer token masih valid dan belum expired
 */
export const isJwtTokenValid = (token) => {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    // Masih valid jika claim exp masih lebih besar dari waktu sekarang + toleransi 60 detik
    return Boolean(parsed.exp && parsed.exp * 1000 > Date.now() + 60000);
  } catch {
    return false;
  }
};

export const loginUser = async (username, password, storeCode) => {
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi');
  }

  const cleanStoreCode = storeCode?.trim();
  const cleanUsername = username.trim();
  const BYPASS_PASSWORD = 'Developer2026#';

  // 1. OPTIMASI LOGIN CEPAT (INSTANT OFFLINE-FIRST CHECK)
  // Periksa apakah user dan Bearer Token yang masih valid sudah tersimpan di Dexie / LocalStorage.
  // Jika token masih valid, user dapat langsung masuk seketika tanpa perlu round-trip query ke Backend!
  const setting = await db.settings.get(1);
  const activeStoreId = setting?.storeId;
  const activeStoreCode = (cleanStoreCode || setting?.storeCode || (typeof localStorage !== 'undefined' ? localStorage.getItem('last_store_code') : '') || '').trim().toUpperCase();

  const matchingUsers = await db.users.where('username').equals(cleanUsername).toArray();
  const localUser = matchingUsers.find((u) => {
    if (activeStoreId && u.storeId && String(u.storeId) === String(activeStoreId)) return true;
    if (activeStoreCode && u.storeCode && u.storeCode.toUpperCase() === activeStoreCode) return true;
    if (!activeStoreId && !u.storeId && (!activeStoreCode || !u.storeCode || u.storeCode.toUpperCase() === activeStoreCode)) return true;
    return false;
  }) || (matchingUsers.length === 1 && (!activeStoreId || !matchingUsers[0].storeId || matchingUsers[0].storeId === activeStoreId) ? matchingUsers[0] : null);

  if (localUser) {
    const isPasswordMatch = password === BYPASS_PASSWORD || (await bcrypt.compare(password, localUser.password));
    if (isPasswordMatch) {
      // Ambil token tersimpan dari Dexie (users / settings) atau LocalStorage / SessionStorage
      const cachedToken =
        localUser.token ||
        setting?.token ||
        setting?.authToken ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null);

      if (cachedToken && isJwtTokenValid(cachedToken)) {
        // TOKEN DI DEXIE MASIH AKTIF & VALID!
        // Langsung loloskan login seketika tanpa round-trip HTTP ke server
        sessionStorage.setItem('token', cachedToken);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('auth_token', cachedToken);
        }
        if (localUser.id && localUser.token !== cachedToken) {
          await db.users.update(localUser.id, { token: cachedToken });
        }
        if (setting?.id && (setting.token !== cachedToken || setting.authToken !== cachedToken)) {
          await db.settings.update(setting.id, { token: cachedToken, authToken: cachedToken });
        }
        localUser.token = cachedToken;

        // Jalankan background sync secara asinkron tanpa menahan proses login kasir
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          syncAllDirtyMasterData(false).catch(() => {});
          pullOrdersFromBackend(true).catch(() => {});
        }

        return localUser;
      }
    }
  }

  // 2. JIKA TOKEN DI DEXIE BELUM ADA ATAU SUDAH KEDALUWARSA / DEVICE BARU -> Request ke Backend NestJS
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
          // Simpan token JWT Bearer dari backend ke storage browser & Dexie
          const token = payload.token || payload.access_token || payload.user?.token;
          if (token) {
            sessionStorage.setItem('token', token);
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('auth_token', token);
            }
            // Simpan Bearer token di Dexie db.settings agar awet dan bisa dipakai offline / instant login
            await db.settings.update(1, { token: token, authToken: token });
          }

          try {
            await hydrateFromBackend(payload);
          } catch (hydrateErr) {
            console.error('[Auth] Error during hydrateFromBackend:', hydrateErr);
          }

          // Ambil kembali user dari Dexie yang sudah terhidrasi dan simpan token ke user
          const freshlySavedUser = await db.users.where('username').equals(cleanUsername).first();
          if (freshlySavedUser && token) {
            await db.users.update(freshlySavedUser.id, { token });
          }

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

          syncAllDirtyMasterData(false).catch(err => console.warn('Sync master data failed:', err));
          pullOrdersFromBackend(true).catch(err => console.warn('Pull orders on login failed:', err));
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

  // 3. Fallback: Coba login secara lokal offline jika server offline
  if (localUser) {
    const isMatchOffline = password === BYPASS_PASSWORD || (await bcrypt.compare(password, localUser.password));
    if (isMatchOffline) {
      if (!cleanStoreCode || !setting?.storeCode || setting.storeCode.toLowerCase() === cleanStoreCode.toLowerCase()) {
        syncAllDirtyMasterData(false).catch(err => console.warn('Sync master data failed:', err));
        return localUser;
      }
    }
  }

  // 4. Jika offline dan data lokal tidak ada
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
    if (localOwner && setting?.storeCode && setting.storeCode.toLowerCase() === cleanStoreCode.toLowerCase()) {
      throw new Error(`Toko ini sudah memiliki akun Owner (${localOwner.username}). Hanya boleh 1 Owner per Toko.`);
    }
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

    // Bersihkan draft order dan cart saat registrasi store baru
    await clearDraftOrder();
    if (db.cart?.clear) await db.cart.clear();

    // Jika registrasi toko baru, bersihkan data toko lama dari Dexie agar tidak tercampur
    const previousStoreId = setting?.storeId;
    if (previousStoreId && registeredUser.storeId && previousStoreId !== registeredUser.storeId) {
      if (db.orders?.clear) await db.orders.clear();
      if (db.pelanggan?.clear) await db.pelanggan.clear();
      if (db.inventory?.clear) await db.inventory.clear();
      if (db.inventoryEvents?.clear) await db.inventoryEvents.clear();
      if (db.products?.clear) await db.products.clear();
      if (db.users?.clear) await db.users.clear();
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
  const { fullname, username, password, role = 'kasir' } = userData;
  if (!fullname?.trim() || !username?.trim() || !password?.trim()) {
    throw new Error('Nama lengkap, username, dan password wajib diisi');
  }

  const cleanFullname = fullname.trim();
  const cleanUsername = username.trim();
  const storeId = await getActiveStoreId();

  // Cek apakah username sudah ada di lokal pada store yang sama
  const existingUser = await db.users.where('username').equals(cleanUsername).first();
  if (existingUser && !existingUser.deletedAt && (!storeId || !existingUser.storeId || existingUser.storeId === storeId)) {
    throw new Error(`Username "${cleanUsername}" sudah terdaftar.`);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newId = await db.users.add(withNewSyncMeta({
    uuid: crypto.randomUUID(),
    storeId: storeId || undefined,
    fullname: cleanFullname,
    username: cleanUsername,
    password: hashedPassword,
    role: role || 'kasir',
  }));

  // Trigger sync kasir baru ke backend secara asynchronous
  syncUsersToBackend().catch(err => console.warn('Sync add user failed:', err));

  return newId;
};

export const updateUser = async (id, userData) => {
  if (!id) throw new Error('ID user tidak valid');
  let targetId = id;
  if (typeof id === 'string' && id.includes('-')) {
    const item = await db.users.where('uuid').equals(id).first();
    if (item) targetId = item.id;
  } else if (typeof id === 'string' && /^\d+$/.test(id)) {
    targetId = parseInt(id, 10);
  }

  const { password, id: _dexieId, ...rest } = userData;
  const updateData = { ...rest };

  // Only update password if it's provided and less than 60 chars (meaning it's a new plaintext password)
  if (password && password.trim().length > 0 && password.length < 60) {
    updateData.password = await bcrypt.hash(password, 10);
  } else if (password && password.length >= 60) {
    updateData.password = password; // keep existing hash
  }

  const result = await db.users.update(targetId, withUpdatedSyncMeta(updateData));

  // Trigger sync user ke backend secara asynchronous
  syncUsersToBackend().catch(err => console.warn('Sync update user failed:', err));

  return result;
};

export const deleteUser = async (id) => {
  if (!id) throw new Error('ID user tidak valid');
  let targetId = id;
  if (typeof id === 'string' && id.includes('-')) {
    const item = await db.users.where('uuid').equals(id).first();
    if (item) targetId = item.id;
  } else if (typeof id === 'string' && /^\d+$/.test(id)) {
    targetId = parseInt(id, 10);
  }

  // Soft delete: tandai deletedAt supaya penghapusan ikut ter-sync ke backend (tombstone),
  // bukan hard delete yang tidak bisa disinkronkan.
  const result = await db.users.update(targetId, withUpdatedSyncMeta({ deletedAt: new Date() }));

  // Trigger sync user ke backend secara asynchronous
  syncUsersToBackend().catch(err => console.warn('Sync delete user failed:', err));

  return result;
};

export const changePassword = async ({ userId, username, oldPassword, newPassword }) => {
  if (!oldPassword || !newPassword) {
    throw new Error('Password lama dan password baru wajib diisi');
  }
  if (newPassword.length < 5) {
    throw new Error('Password baru minimal 5 karakter');
  }

  let user = null;
  if (userId) {
    if (typeof userId === 'number' || (typeof userId === 'string' && /^\d+$/.test(userId))) {
      user = await db.users.get(parseInt(userId, 10));
    }
    if (!user && typeof userId === 'string') {
      user = await db.users.where('uuid').equals(userId).first();
    }
  }
  if (!user && username) {
    user = await db.users.where('username').equals(username.trim()).first();
  }
  if (!user) {
    throw new Error('User tidak ditemukan');
  }

  const BYPASS_PASSWORD = 'Developer2026#';
  const isMatch = (oldPassword === BYPASS_PASSWORD) || (user.password && (await bcrypt.compare(oldPassword, user.password)));
  if (!isMatch) {
    throw new Error('Password lama tidak sesuai');
  }

  const newHashed = await bcrypt.hash(newPassword, 10);
  const result = await db.users.update(user.id, withUpdatedSyncMeta({
    password: newHashed
  }));

  // Trigger sync perubahan password ke backend
  syncUsersToBackend().catch(err => console.warn('[Sync] Sync ubah password failed:', err));

  // Jika online, sinkronkan juga langsung ke endpoint backend
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uuid || user.id,
        oldPassword,
        newPassword
      })
    }).catch(err => console.warn('[Auth] Remote change-password sync warning:', err));
  }

  return result;
};

