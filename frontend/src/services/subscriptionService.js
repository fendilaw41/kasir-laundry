import { db } from '../db';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const BILLING_WA = import.meta.env.VITE_BILLING_WHATSAPP_NUMBER || '6281234567890';

export const isSubscriptionEnabled = () => {
  const val = String(import.meta.env.VITE_FEATURE_SUBSCRIPTION_ENABLED ?? '').trim().toLowerCase();
  return val === 'true' || val === '1';
};

export const IS_FEATURE_ENABLED = isSubscriptionEnabled();

export const isUpgradeBannerEnabled = () => {
  if (!isSubscriptionEnabled()) return false;
  const val = String(import.meta.env.VITE_SHOW_UPGRADE_BANNER ?? '').trim().toLowerCase();
  return val === 'true' || val === '1';
};

export const PLAN_CONFIGS = {
  TRIAL: {
    name: 'Trial (Gratis)',
    price: 0,
    priceLabel: 'Gratis',
    maxTransactions: 30,
    maxChatPhotos: 30,
    botTransactions: 10,
    maxPdfInvoice: 0,
    watermarkTracking: true,
    maxStockItems: 0,
    lowStockNotification: false,
    maxOutlets: 1,
    maxUsers: 1,
    dataHistoryMonths: 1,
    photoRetentionDays: 30,
    supportType: 'Panduan',
    badgeColor: 'secondary',
  },
  STARTER: {
    name: 'Starter',
    price: 25000,
    priceLabel: '25rb/bln',
    maxTransactions: 150,
    maxChatPhotos: 300,
    botTransactions: 0,
    maxPdfInvoice: 20,
    watermarkTracking: true,
    maxStockItems: 5,
    lowStockNotification: false,
    maxOutlets: 1,
    maxUsers: 2,
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
    maxTransactions: 400,
    maxChatPhotos: 800,
    botTransactions: 200,
    maxPdfInvoice: 100,
    watermarkTracking: false,
    maxStockItems: 20,
    lowStockNotification: true,
    maxOutlets: 1,
    maxUsers: 3,
    dataHistoryMonths: 6,
    photoRetentionDays: 90,
    supportType: 'Chat',
    badgeColor: 'primary',
  },
  PRO: {
    name: 'Pro',
    price: 100000,
    priceLabel: '100rb/bln',
    maxTransactions: 1000,
    maxChatPhotos: 2000,
    botTransactions: 1000,
    maxPdfInvoice: -1,
    watermarkTracking: false,
    maxStockItems: 50,
    lowStockNotification: true,
    maxOutlets: 2,
    maxUsers: 5,
    dataHistoryMonths: 12,
    photoRetentionDays: 180,
    supportType: 'Prioritas',
    badgeColor: 'warning',
  },
  BUSINESS: {
    name: 'Business',
    price: 200000,
    priceLabel: '200rb/bln',
    maxTransactions: 3000, // Fair Use Policy
    maxChatPhotos: 5000,
    botTransactions: -1,
    maxPdfInvoice: -1,
    customPdfLogo: true,
    watermarkTracking: false,
    customTrackingView: true,
    maxStockItems: -1,
    lowStockNotification: true,
    maxOutlets: 5,
    maxUsers: 15,
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
        dataHistoryMonths: 999,
        photoRetentionDays: 999,
        supportType: 'Full',
      },
      usage: {
        transactions: { used: 0, limit: -1, topup: 0, totalLimit: -1, remaining: 9999, percentage: 0, isWarning: false, isExceeded: false },
        photos: { used: 0, limit: -1, topup: 0, totalLimit: -1, remaining: 9999, percentage: 0, isWarning: false, isExceeded: false, retentionDays: 999, expiringSoonCount: 0 },
        users: { used: 1, limit: 999, remaining: 999, isExceeded: false },
        inventory: { used: 0, limit: -1, remaining: 999, isExceeded: false },
      },
      whatsappBillingNumber: BILLING_WA,
    };
  }

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const storeId = user?.storeId || null;

  if (token) {
    try {
      const res = await fetch(`${API_URL}/subscription/usage`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          // Cache ke settings Dexie jika memungkinkan
          try {
            await db.settings.where('id').equals(1).modify({
              cachedSubscription: json.data,
            });
          } catch (e) {}
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

  try {
    trxCount = await db.orders
      .filter((o) => !o.deletedAt && new Date(o.createdAt) >= startOfMonth)
      .count();
  } catch (e) {}

  try {
    userCount = await db.users.filter((u) => !u.deletedAt).count();
    if (userCount === 0) userCount = 1;
  } catch (e) {}

  try {
    invCount = await db.inventory.filter((i) => !i.deletedAt).count();
  } catch (e) {}

  // Coba ambil paket dari cache settings
  let cachedPlan = 'TRIAL';
  try {
    const s = await db.settings.get(1);
    if (s?.cachedSubscription?.plan) {
      cachedPlan = s.cachedSubscription.plan;
    }
  } catch (e) {}

  const limits = PLAN_CONFIGS[cachedPlan] || PLAN_CONFIGS.TRIAL;
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
  const price = plan?.priceLabel || '';
  const cleanName = storeName || 'Toko Laundry';

  const text = encodeURIComponent(
    `Halo Admin Kasir Laundry,\n\nSaya ingin mengajukan UPGRADE PAKET langganan untuk:\nNama Toko: ${cleanName}\nPaket Tujuan: ${targetName} (${price})\n\nMohon info nomor rekening / tagihan pembayaran. Terima kasih!`
  );

  return `https://wa.me/${BILLING_WA}?text=${text}`;
}

/**
 * Membuat tautan WhatsApp untuk top-up kuota
 */
export function getTopupWhatsAppUrl(type, amount, storeName) {
  const cleanName = storeName || 'Toko Laundry';
  const label = type === 'TRANSACTIONS' ? `${amount} Transaksi` : `${amount} Foto Chat`;

  const text = encodeURIComponent(
    `Halo Admin Kasir Laundry,\n\nSaya ingin membeli TOP-UP KUOTA tambahan untuk:\nNama Toko: ${cleanName}\nJenis Kuota: ${label}\n\nMohon info rincian biaya dan nomor rekening. Terima kasih!`
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
  } catch (e) {}

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
