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
  maxOutlets: number;
  maxUsers: number;
  dataHistoryMonths: number;
  photoRetentionDays: number;
  supportType: string;
}

export const getPlanLimits = (): Record<string, PlanLimits> => {
  const businessMaxTrx = parseInt(process.env.PLAN_BUSINESS_MAX_TRANSACTIONS || '3000', 10);

  return {
    TRIAL: {
      name: 'Trial (Gratis)',
      price: 0,
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
    },
    STARTER: {
      name: 'Starter',
      price: 25000,
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
    },
    BASIC: {
      name: 'Basic',
      price: 50000,
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
    },
    PRO: {
      name: 'Pro',
      price: 100000,
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
    },
    BUSINESS: {
      name: 'Business',
      price: 200000,
      maxTransactions: businessMaxTrx, // FUP 3000
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
    },
  };
};

