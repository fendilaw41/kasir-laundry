/**
 * Utility untuk normalisasi dan parsing instrumen pembayaran Mayar.id secara defensif.
 * Memastikan parser tidak pernah crash (never throw) dan mengamankan skema URL.
 */

const ALLOWED_URL_SCHEMES = new Set([
  'https:',
  'dana:',
  'gojek:',
  'shopeeid:',
]);

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractString(
  record: Record<string, unknown> | null,
  key: string,
): string | undefined {
  if (!record) return undefined;
  const val = record[key];
  return typeof val === 'string' && val.trim().length > 0
    ? val.trim()
    : undefined;
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
        extractString(channelProps, 'qr_string') ||
        extractString(qrData, 'qr_string') ||
        extractString(detail, 'qrString') ||
        extractString(detail, 'qr_string') ||
        extractString(detail, 'qrCode');

      if (qrString) {
        return {
          type: 'QR_CODE',
          qrString,
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
        extractString(channelProps, 'virtual_account_number') ||
        extractString(vaData, 'virtual_account_number') ||
        extractString(detail, 'vaNumber') ||
        extractString(detail, 'accountNumber');
      const vaBank =
        extractString(vaData, 'channel_code') ||
        extractString(channelProps, 'channel_code') ||
        extractString(detail, 'vaBank') ||
        extractString(detail, 'bank');
      const customerName =
        extractString(channelProps, 'customer_name') ||
        extractString(vaData, 'customer_name') ||
        extractString(detail, 'customerName');

      if (vaNumber) {
        return {
          type: 'VIRTUAL_ACCOUNT',
          vaNumber,
          vaBank: vaBank ? vaBank.toUpperCase() : undefined,
          customerName,
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
        if (item && typeof item.url === 'string') {
          const validUrl = safeUrl(item.url);
          if (validUrl) {
            sanitizedActions.push({
              url: validUrl,
              urlType: String(item.url_type || item.type || 'WEB').toUpperCase(),
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
