import { db } from '../../db.js';
import { getActiveStoreId } from './storeHelper.js';
import { withNewSyncMeta, withUpdatedSyncMeta } from '../syncMeta.js';
import { triggerUnauthorized } from '../../utils/authSession.js';

const API_BASE_URL = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' && window.location?.origin ? `${window.location.origin}/api` : 'http://localhost:3000/api');

/**
 * LiveQuery helper untuk mengambil 5 notifikasi terbaru sesuai role user
 */
export const getNotificationsQuery = (user) => async () => {
  if (!db.notifications) return [];
  const storeId = await getActiveStoreId();
  const userRole = user?.role;

  let all = await db.notifications.orderBy('createdAt').reverse().toArray();

  if (storeId) {
    all = all.filter((n) => !n.storeId || n.storeId === storeId);
  }

  if (userRole) {
    all = all.filter((n) => !n.role || n.role === userRole);
  }

  return all.slice(0, 5);
};

/**
 * Tambah notifikasi baru ke database lokal
 */
export const addNotification = async (data) => {
  if (!db.notifications) return null;
  const storeId = data.storeId || (await getActiveStoreId());
  const newNotif = withNewSyncMeta({
    storeId,
    title: data.title,
    message: data.message,
    type: data.type || 'INFO',
    link: data.link || null,
    role: data.role || null,
    isRead: false,
    createdAt: data.createdAt || new Date().toISOString(),
  });

  return await db.notifications.add(newNotif);
};

/**
 * Tandai satu notifikasi sebagai sudah dibaca
 */
export const markNotificationRead = async (id, uuid) => {
  if (!db.notifications) return;

  if (typeof id === 'number') {
    await db.notifications.update(id, withUpdatedSyncMeta({ isRead: true }));
  } else if (uuid) {
    const item = await db.notifications.where('uuid').equals(uuid).first();
    if (item) {
      await db.notifications.update(item.id, withUpdatedSyncMeta({ isRead: true }));
    }
  }

  // Sync status read ke backend jika online
  try {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) || sessionStorage.getItem('token');
    const targetId = uuid || id;
    if (token && targetId) {
      await fetch(`${API_BASE_URL}/notifications/${targetId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (err) {
    console.warn('[Notification] Failed to sync mark-read to backend:', err);
  }
};

/**
 * Tandai semua notifikasi toko sebagai sudah dibaca
 */
export const markAllNotificationsRead = async (user) => {
  if (!db.notifications) return;
  const storeId = await getActiveStoreId();
  const userRole = user?.role;

  await db.transaction('rw', db.notifications, async () => {
    let unread = await db.notifications.filter((n) => !n.isRead).toArray();
    if (storeId) {
      unread = unread.filter((n) => !n.storeId || n.storeId === storeId);
    }
    if (userRole) {
      unread = unread.filter((n) => !n.role || n.role === userRole);
    }

    for (const item of unread) {
      await db.notifications.update(item.id, withUpdatedSyncMeta({ isRead: true }));
    }
  });

  try {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) || sessionStorage.getItem('token');
    if (token) {
      await fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (err) {
    console.warn('[Notification] Failed to sync mark-all-read to backend:', err);
  }
};

/**
 * Sinkronisasi notifikasi terbaru dari backend PostgreSQL ke Dexie
 */
export const syncNotificationsFromBackend = async () => {
  if (!db.notifications) return;
  try {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) || sessionStorage.getItem('token');
    if (!token) return;

    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      triggerUnauthorized('Sesi login telah berakhir.');
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    const serverNotifications = data?.notifications || [];

    await db.transaction('rw', db.notifications, async () => {
      for (const item of serverNotifications) {
        const existing = await db.notifications.where('uuid').equals(item.id).first();
        if (!existing) {
          await db.notifications.add({
            uuid: item.id,
            storeId: item.storeId,
            role: item.role,
            title: item.title,
            message: item.message,
            type: item.type,
            link: item.link,
            isRead: item.isRead,
            createdAt: item.createdAt,
            isDirty: 0,
          });
        } else if (existing.isRead !== item.isRead) {
          await db.notifications.update(existing.id, { isRead: item.isRead });
        }
      }
    });
  } catch (err) {
    console.warn('[Notification] Sync notifications from backend warning:', err);
  }
};
