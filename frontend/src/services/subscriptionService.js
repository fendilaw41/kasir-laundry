import { db } from '../db';
import { getPlanByKey, getAllPlansLocal, syncPlansFromBackend } from '../db/repositories/plans';
import { triggerUnauthorized } from '../utils/authSession';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const BILLING_WA = import.meta.env.VITE_BILLING_WHATSAPP_NUMBER || '6281234567890';

export const isSubscriptionEnabled = (overrideUser) => {
  if (overrideUser && typeof overrideUser.featureSubscriptionEnabled === 'boolean') {
    return overrideUser.featureSubscriptionEnabled;
  }
  if (typeof window !== 'undefined') {
    try {
      const storedUser = JSON.parse(
        window.sessionStorage?.getItem('user') || window.localStorage?.getItem('user') || '{}'
      );
      if (typeof storedUser?.featureSubscriptionEnabled === 'boolean') {
        return storedUser.featureSubscriptionEnabled;
      }
    } catch { }
  }
  const val = String(import.meta.env.VITE_FEATURE_SUBSCRIPTION_ENABLED ?? '').trim().toLowerCase();
  return val === 'true' || val === '1';
};

export const IS_FEATURE_ENABLED = isSubscriptionEnabled();

export const isUpgradeBannerEnabled = (overrideUser) => {
  if (!isSubscriptionEnabled(overrideUser)) return false;

  if (overrideUser && typeof overrideUser.showUpgradeBanner === 'boolean') {
    return overrideUser.showUpgradeBanner;
  }
  if (typeof window !== 'undefined') {
    try {
      const storedUser = JSON.parse(
        window.sessionStorage?.getItem('user') || window.localStorage?.getItem('user') || '{}'
      );
      if (typeof storedUser?.showUpgradeBanner === 'boolean') {
        return storedUser.showUpgradeBanner;
      }
    } catch { }
  }
  const val = String(import.meta.env.VITE_SHOW_UPGRADE_BANNER ?? '').trim().toLowerCase();
  return val === 'true' || val === '1';
};

export const PLAN_CONFIGS = {
  TRIAL: {
    name: 'Trial (Gratis)',
    price: 0,
    priceLabel: 'Gratis',
    maxTransactions: 30,
    maxChatPhotos: 5,
    botTransactions: 10,
    maxPdfInvoice: 0,
    watermarkTracking: true,
    maxStockItems: 3,
    lowStockNotification: false,
    hasStockHistory: false,
    maxOutlets: 1,
    maxUsers: 2,
    maxProducts: 12,
    dataHistoryMonths: 1,
    photoRetentionDays: 30,
    supportType: 'Panduan',
    badgeColor: 'secondary',
  },
  STARTER: {
    name: 'Starter',
    price: 25000,
    priceLabel: '25rb/bln',
    maxTransactions: 100,
    maxChatPhotos: 5,
    botTransactions: 0,
    maxPdfInvoice: 20,
    watermarkTracking: true,
    maxStockItems: 5,
    lowStockNotification: false,
    hasStockHistory: false,
    maxOutlets: 1,
    maxUsers: 2,
    maxProducts: 20,
    dataHistoryMonths: 3,
    photoRetentionDays: 60,
    supportType: 'Komunitas',
    badgeColor: 'info',
  },
  BASIC: {
    name: 'Basic',
    price: 50000,
    priceLabel: '50rb/bln',
    isPopular: true,
    maxTransactions: 150,
    maxChatPhotos: 20,
    botTransactions: 20,
    maxPdfInvoice: 100,
    watermarkTracking: false,
    maxStockItems: 20,
    lowStockNotification: true,
    hasStockHistory: true,
    maxOutlets: 1,
    maxUsers: 3,
    maxProducts: 50,
    dataHistoryMonths: 6,
    photoRetentionDays: 90,
    supportType: 'Chat',
    badgeColor: 'primary',
  },
  PRO: {
    name: 'Pro',
    price: 100000,
    priceLabel: '100rb/bln',
    maxTransactions: 300,
    maxChatPhotos: 100,
    botTransactions: 200,
    maxPdfInvoice: -1,
    watermarkTracking: false,
    maxStockItems: 50,
    lowStockNotification: true,
    hasStockHistory: true,
    maxOutlets: 2,
    maxUsers: 5,
    maxProducts: 100,
    dataHistoryMonths: 12,
    photoRetentionDays: 180,
    supportType: 'Prioritas',
    badgeColor: 'warning',
  },
  BUSINESS: {
    name: 'Business',
    price: 200000,
    priceLabel: '200rb/bln',
    maxTransactions: 1000, // Fair Use Policy
    maxChatPhotos: 500,
    botTransactions: 1000,
    maxPdfInvoice: -1,
    customPdfLogo: true,
    watermarkTracking: false,
    customTrackingView: true,
    maxStockItems: -1,
    lowStockNotification: true,
    hasStockHistory: true,
    maxOutlets: 5,
    maxUsers: -1, // tak terhingga
    maxProducts: -1, // tak terhingga
    dataHistoryMonths: 24,
    photoRetentionDays: 365,
    supportType: 'Prioritas + Onboarding',
    badgeColor: 'dark',
  },
};

/**
 * Mengambil status dan laporan penggunaan paket dari backend atau fallback ke kalkulasi Dexie
 */
export async function getSubscriptionReport() {
  if (!isSubscriptionEnabled()) {
    return {
      enabled: false,
      plan: 'UNLIMITED',
      status: 'ACTIVE',
      isEnforced: false,
      limits: {
        maxTransactions: -1,
        maxChatPhotos: -1,
        botTransactions: -1,
        maxPdfInvoice: -1,
        watermarkTracking: false,
        maxStockItems: -1,
        lowStockNotification: true,
        maxOutlets: 999,
        maxUsers: 999,
        maxProducts: -1,
        dataHistoryMonths: 999,
        photoRetentionDays: 999,
        supportType: 'Full',
      },
      usage: {
        transactions: { used: 0, limit: -1, topup: 0, totalLimit: -1, remaining: 9999, percentage: 0, isWarning: false, isExceeded: false },
        photos: { used: 0, limit: -1, topup: 0, totalLimit: -1, remaining: 9999, percentage: 0, isWarning: false, isExceeded: false, retentionDays: 999, expiringSoonCount: 0 },
        users: { used: 1, limit: 999, remaining: 999, isExceeded: false },
        inventory: { used: 0, limit: -1, remaining: 999, isExceeded: false },
        products: { used: 0, limit: -1, remaining: 9999, percentage: 0, isExceeded: false },
      },
      whatsappBillingNumber: BILLING_WA,
    };
  }

  const token =
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') : null) ||
    (await db.settings.get(1))?.token ||
    (await db.settings.get(1))?.authToken;
  const userStr =
    (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null) ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null);
  const user = userStr ? JSON.parse(userStr) : null;
  const setting = await db.settings.get(1);
  const storeId = user?.storeId || setting?.storeId || null;

  if (token) {
    try {
      // Sinkronkan update master plan dari DB ke Dexie di background
      syncPlansFromBackend().catch(() => { });

      const res = await fetch(`${API_URL}/subscription/usage`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status === 401) {
        triggerUnauthorized('Sesi login telah berakhir.');
        return calculateOfflineUsage(storeId);
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          // Sinkronkan status flag fitur subscription ke session user jika ada perubahan dari server
          try {
            const curUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
            let changed = false;
            if (typeof json.data.featureSubscriptionEnabled === 'boolean' && curUser.featureSubscriptionEnabled !== json.data.featureSubscriptionEnabled) {
              curUser.featureSubscriptionEnabled = json.data.featureSubscriptionEnabled;
              changed = true;
            }
            if (typeof json.data.showUpgradeBanner === 'boolean' && curUser.showUpgradeBanner !== json.data.showUpgradeBanner) {
              curUser.showUpgradeBanner = json.data.showUpgradeBanner;
              changed = true;
            }
            if (changed) {
              if (typeof localStorage !== 'undefined') localStorage.setItem('user', JSON.stringify(curUser));
              if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('user', JSON.stringify(curUser));
            }
          } catch { }

          // Sinkronkan ke db.storeSubscriptions di Dexie
          if (db.storeSubscriptions && (json.data.storeId || storeId)) {
            try {
              const targetSubStoreId = json.data.storeId || storeId;
              const existingSub = await db.storeSubscriptions.where('storeId').equals(targetSubStoreId).first();
              await db.storeSubscriptions.put({
                id: existingSub?.id || json.data.id || crypto.randomUUID(),
                storeId: targetSubStoreId,
                plan: json.data.plan,
                status: json.data.status,
                currentPeriodStart: new Date(json.data.currentPeriodStart || new Date()),
                currentPeriodEnd: json.data.currentPeriodEnd ? new Date(json.data.currentPeriodEnd) : null,
                maxTransactions: json.data.limits?.maxTransactions ?? 150,
                usedTransactions: json.data.usage?.transactions?.used ?? 0,
                remainingTransactions: json.data.usage?.transactions?.remaining ?? 150,
                maxChatPhotos: json.data.limits?.maxChatPhotos ?? 800,
                usedPhotos: json.data.usage?.photos?.used ?? 0,
                remainingPhotos: json.data.usage?.photos?.remaining ?? 800,
                maxUsers: json.data.limits?.maxUsers ?? 3,
                usedUsers: json.data.usage?.users?.used ?? 1,
                remainingUsers: json.data.usage?.users?.remaining ?? 2,
                maxProducts: json.data.limits?.maxProducts ?? 50,
                usedProducts: json.data.usage?.products?.used ?? 0,
                remainingProducts: json.data.usage?.products?.remaining ?? 50,
                maxStockItems: json.data.limits?.maxStockItems ?? 20,
                usedInventory: json.data.usage?.inventory?.used ?? 0,
                remainingInventory: json.data.usage?.inventory?.remaining ?? 20,
                updatedAt: new Date(),
              });
            } catch (subErr) {
              console.warn('Gagal update db.storeSubscriptions dari server:', subErr);
            }
          }

          // Cache ke settings Dexie jika memungkinkan
          try {
            await db.settings.where('id').equals(1).modify({
              cachedSubscription: json.data,
              featureSubscriptionEnabled: json.data.featureSubscriptionEnabled,
              showUpgradeBanner: json.data.showUpgradeBanner,
            });
          } catch (e) { }
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Gagal memuat status langganan dari server, beralih ke cache lokal Dexie:', err);
    }
  }

  // Fallback offline kalkulasi via Dexie
  return calculateOfflineUsage(storeId);
}

/**
 * Kalkulasi kuota secara lokal menggunakan data di Dexie (saat offline)
 */
async function calculateOfflineUsage(storeId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let trxCount = 0;
  let userCount = 1;
  let invCount = 0;
  let prodCount = 0;

  try {
    trxCount = await db.orders
      .filter((o) => !o.deletedAt && new Date(o.createdAt) >= startOfMonth)
      .count();
  } catch (e) { }

  try {
    userCount = await db.users.filter((u) => !u.deletedAt).count();
    if (userCount === 0) userCount = 1;
  } catch (e) { }

  try {
    invCount = await db.inventory.filter((i) => !i.deletedAt).count();
  } catch (e) { }

  try {
    prodCount = db.products
      ? await db.products.filter((p) => !p.deletedAt && (!storeId || !p.storeId || p.storeId === storeId)).count()
      : 0;
  } catch (e) { }

  // Coba ambil paket dari db.storeSubscriptions atau cache settings
  let cachedPlan = 'TRIAL';
  try {
    const sub = storeId && db.storeSubscriptions
      ? await db.storeSubscriptions.where('storeId').equals(storeId).first()
      : (db.storeSubscriptions ? await db.storeSubscriptions.toCollection().first() : null);
    if (sub?.plan) {
      cachedPlan = sub.plan;
    } else {
      const s = await db.settings.get(1);
      if (s?.cachedSubscription?.plan) {
        cachedPlan = s.cachedSubscription.plan;
      }
    }
  } catch (e) { }

  const dbPlan = await getPlanByKey(cachedPlan);
  const limits = dbPlan || PLAN_CONFIGS[cachedPlan] || PLAN_CONFIGS.TRIAL;
  const totalTrx = limits.maxTransactions;
  const trxPercent = totalTrx === -1 ? 0 : Math.min(100, Math.round((trxCount / totalTrx) * 100));

  return {
    plan: cachedPlan,
    status: 'ACTIVE',
    currentPeriodStart: startOfMonth,
    currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    isEnforced: isSubscriptionEnabled(),
    limits,
    usage: {
      transactions: {
        used: trxCount,
        limit: totalTrx,
        topup: 0,
        totalLimit: totalTrx,
        remaining: totalTrx === -1 ? 999999 : Math.max(0, totalTrx - trxCount),
        percentage: trxPercent,
        isWarning: trxPercent >= 80 && trxPercent < 100,
        isExceeded: totalTrx !== -1 && trxCount >= totalTrx,
      },
      photos: {
        used: 0,
        limit: limits.maxChatPhotos,
        topup: 0,
        totalLimit: limits.maxChatPhotos,
        remaining: limits.maxChatPhotos,
        percentage: 0,
        isWarning: false,
        isExceeded: false,
        retentionDays: limits.photoRetentionDays,
        expiringSoonCount: 0,
      },
      users: {
        used: userCount,
        limit: limits.maxUsers,
        remaining: Math.max(0, limits.maxUsers - userCount),
        isExceeded: userCount >= limits.maxUsers,
      },
      inventory: {
        used: invCount,
        limit: limits.maxStockItems,
        remaining: limits.maxStockItems === -1 ? 999999 : Math.max(0, limits.maxStockItems - invCount),
        isExceeded: limits.maxStockItems !== -1 && invCount >= limits.maxStockItems,
      },
      products: {
        used: prodCount,
        limit: limits.maxProducts ?? 50,
        remaining: limits.maxProducts === -1 ? 999999 : Math.max(0, (limits.maxProducts ?? 50) - prodCount),
        percentage: limits.maxProducts === -1 ? 0 : Math.min(100, Math.round((prodCount / (limits.maxProducts ?? 50)) * 100)),
        isExceeded: limits.maxProducts !== -1 && prodCount >= (limits.maxProducts ?? 50),
      },
    },
    whatsappBillingNumber: BILLING_WA,
  };
}

/**
 * Membuat tautan WhatsApp untuk upgrade paket
 */
export function getUpgradeWhatsAppUrl(planKey, storeName) {
  const plan = PLAN_CONFIGS[planKey];
  const targetName = plan?.name || planKey;
  const cleanName = storeName || 'Toko Laundry';

  const text = encodeURIComponent(
    `Halo Admin, saya ingin mengajukan paket ${targetName} untuk toko ${cleanName}.`
  );

  return `https://wa.me/${BILLING_WA}?text=${text}`;
}

/**
 * Membuat tautan WhatsApp untuk top-up kuota
 */
export function getTopupWhatsAppUrl(type, amount, storeName, price) {
  const cleanName = storeName || 'Toko Laundry';
  const label = type === 'TRANSACTIONS' ? `${amount} Transaksi` : `${amount} Foto Chat`;
  const defaultPrice =
    type === 'TRANSACTIONS'
      ? amount === 50 ? 'Rp 20.000' : 'Rp 25.000'
      : 'Rp 50.000';
  const finalPrice = price || defaultPrice;

  const text = encodeURIComponent(
    `Halo Admin Kasir Laundry,\n\nSaya ingin membeli TOP-UP KUOTA tambahan:\nNama Toko: ${cleanName}\nJenis Kuota: +${label}\nBiaya: ${finalPrice}\n\nMohon info nomor rekening pembayarannya. Terima kasih!`
  );

  return `https://wa.me/${BILLING_WA}?text=${text}`;
}


/**
 * Menerapkan / Mengubah paket langganan secara langsung ke Backend & sinkronkan ke cache Dexie
 */
export async function applyPlan(planKey) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) throw new Error('Anda belum login.');

  const res = await fetch(`${API_URL}/subscription/upgrade`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan: planKey, durationMonths: 1 }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Gagal mengubah paket langganan.');
  }

  // Update Dexie cached subscription
  try {
    const s = await db.settings.get(1);
    if (s) {
      await db.settings.where('id').equals(1).modify((setting) => {
        if (!setting.cachedSubscription) setting.cachedSubscription = {};
        setting.cachedSubscription.plan = planKey;
      });
    }
  } catch (e) { }

  return json;
}

/**
 * Melakukan top-up kuota tambahan secara langsung
 */
export async function topupQuota(type, amount) {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (!token) throw new Error('Anda belum login.');

  const res = await fetch(`${API_URL}/subscription/topup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type, amount }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Gagal melakukan top-up kuota.');
  }

  return json;
}

/**
 * Menarik status subscription terbaru dari server NestJS dan menyimpannya ke Dexie
 */
export async function pullSubscriptionFromBackend() {
  const token =
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') : null) ||
    (await db.settings.get(1))?.token ||
    (await db.settings.get(1))?.authToken;

  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/subscription/usage`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && json.data) {
      const setting = await db.settings.get(1);
      const storeId = json.data.storeId || setting?.storeId;

      if (db.storeSubscriptions && storeId) {
        try {
          const existingSub = await db.storeSubscriptions.where('storeId').equals(storeId).first();
          await db.storeSubscriptions.put({
            id: existingSub?.id || json.data.id || crypto.randomUUID(),
            storeId,
            plan: json.data.plan,
            status: json.data.status,
            currentPeriodStart: new Date(json.data.currentPeriodStart || new Date()),
            currentPeriodEnd: json.data.currentPeriodEnd ? new Date(json.data.currentPeriodEnd) : null,
            maxTransactions: json.data.limits?.maxTransactions ?? 150,
            usedTransactions: json.data.usage?.transactions?.used ?? 0,
            remainingTransactions: json.data.usage?.transactions?.remaining ?? 150,
            maxChatPhotos: json.data.limits?.maxChatPhotos ?? 800,
            usedPhotos: json.data.usage?.photos?.used ?? 0,
            remainingPhotos: json.data.usage?.photos?.remaining ?? 800,
            maxUsers: json.data.limits?.maxUsers ?? 3,
            usedUsers: json.data.usage?.users?.used ?? 1,
            remainingUsers: json.data.usage?.users?.remaining ?? 2,
            maxProducts: json.data.limits?.maxProducts ?? 50,
            usedProducts: json.data.usage?.products?.used ?? 0,
            remainingProducts: json.data.usage?.products?.remaining ?? 50,
            maxStockItems: json.data.limits?.maxStockItems ?? 20,
            usedInventory: json.data.usage?.inventory?.used ?? 0,
            remainingInventory: json.data.usage?.inventory?.remaining ?? 20,
            updatedAt: new Date(),
          });
        } catch (e) {
          console.warn('Gagal simpan storeSubscription ke Dexie:', e);
        }
      }

      try {
        await db.settings.where('id').equals(1).modify({
          cachedSubscription: json.data,
          featureSubscriptionEnabled: json.data.featureSubscriptionEnabled,
          showUpgradeBanner: json.data.showUpgradeBanner,
        });
      } catch (e) { }

      return json.data;
    }
  } catch (err) {
    console.warn('Gagal pull subscription dari backend:', err);
  }
  return null;
}

export { syncPlansFromBackend, getPlanByKey, getAllPlansLocal } from '../db/repositories/plans';

