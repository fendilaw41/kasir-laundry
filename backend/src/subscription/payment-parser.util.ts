/**
 * Utility untuk normalisasi dan parsing instrumen pembayaran Mayar.id secara defensif.
 * Memastikan parser tidak pernah crash (never throw) dan mengamankan skema URL.
 */

const ALLOWED_URL_SCHEMES = new Set(['https:', 'dana:', 'gojek:', 'shopeeid:']);

export interface NormalizedPaymentInstrument {
  type: 'QR_CODE' | 'VIRTUAL_ACCOUNT' | 'EWALLET' | 'UNKNOWN';
  qrString?: string;
  vaNumber?: string;
  vaBank?: string;
  customerName?: string;
  actions?: Array<{ url: string; urlType: string }>;
  raw?: unknown;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return ALLOWED_URL_SCHEMES.has(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, any> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return null;
}

/**
 * Parsing payload paymentDetail dari respons create invoice Mayar
 */
export function parsePaymentDetail(
  value: unknown,
): NormalizedPaymentInstrument | null {
  try {
    const detail = asRecord(value);
    if (!detail) return null;

    const rawType = String(detail.type || '').toUpperCase();

    // 1. QR Code (QRIS)
    if (rawType === 'QR_CODE' || detail.qr_code || detail.qrString) {
      const qrData = asRecord(detail.qr_code);
      const channelProps = asRecord(qrData?.channel_properties);
      const qrString =
        channelProps?.qr_string ||
        qrData?.qr_string ||
        detail.qrString ||
        detail.qr_string ||
        detail.qrCode;

      if (typeof qrString === 'string' && qrString.trim().length > 0) {
        return {
          type: 'QR_CODE',
          qrString: qrString.trim(),
        };
      }
    }

    // 2. Virtual Account
    if (
      rawType === 'VIRTUAL_ACCOUNT' ||
      detail.virtual_account ||
      detail.vaNumber
    ) {
      const vaData = asRecord(detail.virtual_account);
      const channelProps = asRecord(vaData?.channel_properties);
      const vaNumber =
        channelProps?.virtual_account_number ||
        vaData?.virtual_account_number ||
        detail.vaNumber ||
        detail.accountNumber;
      const vaBank =
        vaData?.channel_code ||
        channelProps?.channel_code ||
        detail.vaBank ||
        detail.bank;
      const customerName =
        channelProps?.customer_name ||
        vaData?.customer_name ||
        detail.customerName;

      if (typeof vaNumber === 'string' && vaNumber.trim().length > 0) {
        return {
          type: 'VIRTUAL_ACCOUNT',
          vaNumber: vaNumber.trim(),
          vaBank: typeof vaBank === 'string' ? vaBank.toUpperCase() : undefined,
          customerName:
            typeof customerName === 'string' ? customerName : undefined,
        };
      }
    }

    // 3. E-Wallet
    if (rawType === 'EWALLET' || detail.ewallet) {
      const ewalletData = asRecord(detail.ewallet);
      const rawActions = Array.isArray(detail.actions)
        ? detail.actions
        : Array.isArray(ewalletData?.actions)
          ? ewalletData.actions
          : [];

      const sanitizedActions: Array<{ url: string; urlType: string }> = [];
      for (const act of rawActions) {
        const item = asRecord(act);
        if (item && item.url) {
          const validUrl = safeUrl(item.url);
          if (validUrl) {
            sanitizedActions.push({
              url: validUrl,
              urlType: String(
                item.url_type || item.type || 'WEB',
              ).toUpperCase(),
            });
          }
        }
      }

      if (sanitizedActions.length > 0) {
        return {
          type: 'EWALLET',
          actions: sanitizedActions,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
