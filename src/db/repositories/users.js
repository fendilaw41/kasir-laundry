import { db } from '../../db.js';
import bcrypt from 'bcryptjs';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';

export const loginUser = async (username, password) => {
  if (!username || !password) {
    throw new Error('Username dan password wajib diisi');
  }

  const user = await db.users.where('username').equals(username).first();
  if (user && await bcrypt.compare(password, user.password)) {
    return user;
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

  const hashedPassword = await bcrypt.hash(password, 10);
  const newId = await db.users.add(withNewSyncMeta({ fullname, username, password: hashedPassword, role }));
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

  return db.users.update(id, withUpdatedSyncMeta(updateData));
};

export const deleteUser = async (id) => {
  // Soft delete: tandai deletedAt supaya penghapusan ikut ter-sync ke backend (tombstone),
  // bukan hard delete yang tidak bisa disinkronkan.
  return db.users.update(id, withUpdatedSyncMeta({ deletedAt: new Date() }));
};
