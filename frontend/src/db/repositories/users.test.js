import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addUser, updateUser, deleteUser, getKasirUsersQuery } from './users.js';
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
    },
    settings: {
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
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
});

