import { getTrackingUrl } from './tracking.js';

export const DEFAULT_TRACKING_DOMAIN = 'https://kasirlaundry.netlify.app';

/**
 * Cek apakah footer struk dikonfigurasi untuk menampilkan Barcode Invoice (bukan link)
 */
export const isFooterBarcode = (footerText) => {
  if (!footerText) return false;
  return /\b(INVOICE|BARCODE)\b/i.test(footerText);
};

/**
 * Cek apakah footer struk dikonfigurasi untuk menampilkan Link Cek Order
 */
export const isFooterLinkOrder = (footerText) => {
  if (!footerText) return false;
  return /\bLINK_ORDER\b/i.test(footerText);
};

/**
 * Buat URL link cek order resmi (mengarah ke domain https://kasirlaundry.netlify.app/c/...)
 */
export const getReceiptTrackingUrl = (invoiceId) => {
  if (!invoiceId) return '';
  return getTrackingUrl(invoiceId, DEFAULT_TRACKING_DOMAIN);
};

/**
 * Format teks footer:
 * - Jika ada kata LINK_ORDER: diganti dengan link cek order lengkap
 * - Jika ada kata INVOICE / BARCODE: dibersihkan dari teks karena akan dirender sebagai Barcode SVG
 */
export const formatReceiptFooterText = (footerText, invoiceId) => {
  if (!footerText) return '';
  let formatted = String(footerText);

  if (isFooterLinkOrder(formatted)) {
    const linkUrl = getReceiptTrackingUrl(invoiceId);
    formatted = formatted.replace(/\{?\[?LINK_ORDER\]?\}?/gi, linkUrl);
  }

  if (isFooterBarcode(formatted)) {
    // Hapus keyword placeholder INVOICE/BARCODE dari teks agar tidak tercetak ganda di atas barcode
    formatted = formatted
      .replace(/\{?\[?(?:INVOICE|BARCODE)\]?\}?/gi, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  return formatted;
};

