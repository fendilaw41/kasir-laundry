export interface PlanLimits {
  name: string;
  price: number;
  isPopular?: boolean;
  maxTransactions: number; // -1 for unlimited
  maxChatPhotos: number;
  botTransactions: number; // 0 = no, -1 = unlimited
  maxPdfInvoice: number; // 0 = no, -1 = unlimited
  customPdfLogo?: boolean;
  watermarkTracking: boolean;
  customTrackingView?: boolean;
  maxStockItems: number; // 0 = no, -1 = unlimited
  lowStockNotification: boolean;
  hasStockHistory: boolean;
  maxOutlets: number;
  maxUsers: number;
  maxProducts: number; // 12 for trial, -1 for unlimited
  dataHistoryMonths: number;
  photoRetentionDays: number;
  supportType: string;
}

export const getPlanLimits = (): Record<string, PlanLimits> => {
  const businessMaxTrx = parseInt(process.env.PLAN_BUSINESS_MAX_TRANSACTIONS || '1000', 10);

  return {
    TRIAL: {
      name: 'Trial (Gratis)',
      price: 0,
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
    },
    STARTER: {
      name: 'Starter',
      price: 25000,
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
    },
    BASIC: {
      name: 'Basic',
      price: 50000,
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
    },
    PRO: {
      name: 'Pro',
      price: 100000,
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
    },
    BUSINESS: {
      name: 'Business',
      price: 200000,
      maxTransactions: businessMaxTrx, // FUP 1000
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
    },
  };
};

