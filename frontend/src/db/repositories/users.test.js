import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addUser, updateUser, deleteUser, getKasirUsersQuery, changePassword, registerUser, loginUser } from './users.js';
import bcrypt from 'bcryptjs';
import { db } from '../../db.js';

vi.mock('../../services/syncService.js', () => ({
  syncUsersToBackend: vi.fn().mockResolvedValue(true),
  syncAllDirtyMasterData: vi.fn().mockResolvedValue(true),
  syncInventoryToBackend: vi.fn().mockResolvedValue(true),
  pullOrdersFromBackend: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../db.js', () => ({
  db: {
    users: {
      get: vi.fn(),
      toArray: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      where: vi.fn(),
      filter: vi.fn(),
      clear: vi.fn(),
    },
    settings: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      clear: vi.fn(),
    },
    draftOrder: {
      delete: vi.fn(),
      clear: vi.fn(),
    },
    orders: {
      clear: vi.fn(),
    },
    pelanggan: {
      clear: vi.fn(),
    },
    inventory: {
      clear: vi.fn(),
    },
    inventoryEvents: {
      clear: vi.fn(),
    },
    products: {
      clear: vi.fn(),
    },
    plans: {
      put: vi.fn(),
      bulkPut: vi.fn(),
      orderBy: vi.fn(() => ({
        toArray: vi.fn().mockResolvedValue([]),
      })),
    },
    storeSubscriptions: {
      put: vi.fn(),
    },
    transaction: vi.fn(async (mode, tables, cb) => cb()),
  },
}));

describe('users repository - addUser, updateUser, deleteUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  describe('addUser', () => {
    it('throws error when fullname, username, or password is empty', async () => {
      await expect(addUser({ fullname: '', username: 'budi', password: '123' })).rejects.toThrow(
        /Nama lengkap, username, dan password wajib diisi/i
      );
      await expect(addUser({ fullname: 'Budi', username: '', password: '123' })).rejects.toThrow(
        /Nama lengkap, username, dan password wajib diisi/i
      );
      await expect(addUser({ fullname: 'Budi', username: 'budi', password: '' })).rejects.toThrow(
        /Nama lengkap, username, dan password wajib diisi/i
      );
    });

    it('throws error if username is already taken by a non-deleted user', async () => {
      db.users.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 1, username: 'budi', deletedAt: null }),
        }),
      });

      await expect(
        addUser({ fullname: 'Budi Baru', username: 'budi', password: 'secretpassword' })
      ).rejects.toThrow(/Username "budi" sudah terdaftar/i);
    });

    it('allows same username if belonging to a different store', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-123' }));
      db.users.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 1, username: 'budi', storeId: 'store-456', deletedAt: null }),
        }),
      });
      db.users.add.mockResolvedValue(10);

      const newId = await addUser({
        fullname: 'Budi Toko Baru',
        username: 'budi',
        password: 'password123',
        role: 'kasir',
      });

      expect(newId).toBe(10);
      expect(db.users.add).toHaveBeenCalledTimes(1);
    });

    it('successfully adds new cashier without asking for storeCode and hashes password', async () => {
      sessionStorage.setItem('user', JSON.stringify({ storeId: 'store-uuid-123' }));
      db.users.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });
      db.users.add.mockResolvedValue(10);

      const newId = await addUser({
        fullname: 'Budi Santoso',
        username: 'budikasir',
        password: 'password123',
        role: 'kasir',
      });

      expect(newId).toBe(10);
      expect(db.users.add).toHaveBeenCalledTimes(1);
      const addedData = db.users.add.mock.calls[0][0];
      expect(addedData.fullname).toBe('Budi Santoso');
      expect(addedData.username).toBe('budikasir');
      expect(addedData.role).toBe('kasir');
      expect(addedData.storeId).toBe('store-uuid-123');
      expect(addedData.isDirty).toBe(1);
      expect(addedData.password).not.toBe('password123'); // must be hashed
    });
  });

  describe('updateUser', () => {
    it('updates user data and hashes new password if provided', async () => {
      db.users.update.mockResolvedValue(1);

      await updateUser(5, {
        fullname: 'Budi Updated',
        username: 'budi',
        password: 'newpassword123',
      });

      expect(db.users.update).toHaveBeenCalledTimes(1);
      const updatePayload = db.users.update.mock.calls[0][1];
      expect(updatePayload.fullname).toBe('Budi Updated');
      expect(updatePayload.password).not.toBe('newpassword123');
      expect(updatePayload.isDirty).toBe(1);
    });

    it('does not rehash password if empty or already 60 chars hash', async () => {
      db.users.update.mockResolvedValue(1);
      const existingHash = '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqr';

      await updateUser(5, {
        fullname: 'Budi Updated',
        username: 'budi',
        password: existingHash,
      });

      const updatePayload = db.users.update.mock.calls[0][1];
      expect(updatePayload.password).toBe(existingHash);
    });
  });

  describe('deleteUser', () => {
    it('soft deletes user by setting deletedAt and isDirty: 1', async () => {
      db.users.update.mockResolvedValue(1);

      await deleteUser(5);

      expect(db.users.update).toHaveBeenCalledTimes(1);
      const updatePayload = db.users.update.mock.calls[0][1];
      expect(updatePayload.deletedAt).toBeInstanceOf(Date);
      expect(updatePayload.isDirty).toBe(1);
    });
  });

  describe('changePassword', () => {
    it('throws error when validation fails', async () => {
      await expect(changePassword({})).rejects.toThrow(/Password lama dan password baru wajib diisi/i);
      await expect(changePassword({ userId: 1, oldPassword: 'old', newPassword: '' })).rejects.toThrow(/Password lama dan password baru wajib diisi/i);
      await expect(changePassword({ userId: 1, oldPassword: 'old', newPassword: '123' })).rejects.toThrow(/Password baru minimal 5 karakter/i);
      await expect(changePassword({ userId: 999, oldPassword: 'old', newPassword: 'validpass' })).rejects.toThrow(/User tidak ditemukan/i);
    });

    it('throws error if old password does not match', async () => {
      const hashed = bcrypt.hashSync('correctpass', 10);
      db.users.get.mockResolvedValue({ id: 1, username: 'testuser', password: hashed });

      await expect(
        changePassword({ userId: 1, oldPassword: 'wrongpass', newPassword: 'newpassword123' })
      ).rejects.toThrow(/Password lama tidak sesuai/i);
    });

    it('successfully updates password and marks isDirty: 1', async () => {
      const hashed = bcrypt.hashSync('oldsecret', 10);
      db.users.get.mockResolvedValue({ id: 1, username: 'testuser', password: hashed });
      db.users.update.mockResolvedValue(1);

      const result = await changePassword({
        userId: 1,
        oldPassword: 'oldsecret',
        newPassword: 'newsecret123'
      });

      expect(result).toBe(1);
      expect(db.users.update).toHaveBeenCalledTimes(1);
      const updateCall = db.users.update.mock.calls[0][1];
      expect(updateCall.isDirty).toBe(1);
      expect(bcrypt.compareSync('newsecret123', updateCall.password)).toBe(true);
    });
  });

  describe('registerUser', () => {
    it('allows registering same username for a different store via backend', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'uuid-user-2',
              storeId: 'store-uuid-2',
              storeCode: 'STORE02',
              storeName: 'Toko Dua',
              username: 'owner',
              fullname: 'Owner Toko Dua',
              role: 'owner',
              featureSubscriptionEnabled: false,
            },
            token: 'jwt-token-123',
            plans: [{ key: 'TRIAL', name: 'Trial' }],
          },
        }),
      });

      db.settings.get.mockResolvedValue({ id: 1, storeCode: 'STORE01', storeId: 'store-uuid-1' });
      db.users.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ id: 1, username: 'owner', role: 'owner', storeId: 'store-uuid-1' }),
        }),
      });
      db.users.add.mockResolvedValue(2);
      db.settings.update.mockResolvedValue(1);
      db.cart = { clear: vi.fn().mockResolvedValue() };
      db.draftOrder = { delete: vi.fn().mockResolvedValue() };
      db.orders = { clear: vi.fn().mockResolvedValue() };
      db.pelanggan = { clear: vi.fn().mockResolvedValue() };
      db.inventory = { clear: vi.fn().mockResolvedValue() };
      db.inventoryEvents = { clear: vi.fn().mockResolvedValue() };
      db.products = { clear: vi.fn().mockResolvedValue() };

      const newId = await registerUser({
        storeCode: 'STORE02',
        fullname: 'Owner Toko Dua',
        username: 'owner',
        password: 'password123',
        role: 'owner',
      });

      expect(newId).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('saves master plans and storeSubscription to dexie when owner registers with featureSubscriptionEnabled: true', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              id: 'owner-sub-uuid',
              storeId: 'store-sub-uuid',
              storeCode: 'SUB01',
              storeName: 'Toko Sub',
              username: 'ownersub',
              fullname: 'Owner Sub',
              role: 'owner',
              featureSubscriptionEnabled: true,
            },
            storeSubscription: {
              id: 'sub-1',
              storeId: 'store-sub-uuid',
              plan: 'TRIAL',
              status: 'ACTIVE',
            },
            plans: [
              { key: 'TRIAL', name: 'Trial (Gratis)', maxTransactions: 30 },
              { key: 'STARTER', name: 'Starter', maxTransactions: 150 },
            ],
            token: 'jwt-token-sub',
          },
        }),
      });

      db.settings.get.mockResolvedValue({ id: 1, storeCode: 'SUB01', storeId: 'store-sub-uuid' });
      db.users.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });
      db.users.add.mockResolvedValue(10);
      db.settings.update.mockResolvedValue(1);

      const newId = await registerUser({
        storeCode: 'SUB01',
        fullname: 'Owner Sub',
        username: 'ownersub',
        password: 'password123',
        role: 'owner',
      });

      expect(newId).toBe(10);
      expect(db.storeSubscriptions.put).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sub-1',
          storeId: 'store-sub-uuid',
          plan: 'TRIAL',
        })
      );
      expect(db.plans.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'TRIAL',
          name: 'Trial (Gratis)',
          maxTransactions: 30,
        })
      );
    });
  });

  describe('loginUser - multi-store validation', () => {
    it('rejects when storeCode in login differs from user store and backend rejects', async () => {
      // Setup Dexie dengan 1 user toko1 yang memiliki storeCode TOK01
      const hash = await bcrypt.hash('secret123', 10);
      db.settings.get.mockResolvedValue({
        id: 1,
        storeId: 'store-1-uuid',
        storeCode: 'TOK01',
      });

      db.users.where = vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 1,
              username: 'toko1',
              password: hash,
              storeId: 'store-1-uuid',
              storeCode: 'TOK01',
              token: 'header.' + btoa(JSON.stringify({ userId: 'u1', storeCode: 'TOK01', exp: 9999999999 })) + '.sig',
            },
          ]),
        }),
      });

      // Backend me-reject karena toko1 tidak ada di TOK02
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({ message: 'Username atau password salah' }),
      });

      await expect(
        loginUser('toko1', 'secret123', 'TOK02')
      ).rejects.toThrow(/(Username.*password|Kode Toko)/i);
    });
  });
});

