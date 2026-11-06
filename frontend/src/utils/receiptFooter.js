import { getTrackingUrl } from './tracking.js';

export const DEFAULT_TRACKING_DOMAIN =
  import.meta.env?.VITE_PUBLIC_TRACKING_URL || 'https://kasir-laundry-frontend.onrender.com';

/**
 * Cek apakah footer struk dikonfigurasi untuk menampilkan Barcode Invoice (hanya untuk Print PDF/Invoice)
 */
export const isFooterBarcode = (footerText) => {
  if (!footerText) return false;
  return /\b(INVOICE|BARCODE)\b/i.test(footerText);
};

/**
 * Cek apakah footer struk dikonfigurasi untuk menampilkan Link Cek Order (hanya untuk Print Thermal)
 */
export const isFooterLinkOrder = (footerText) => {
  if (!footerText) return false;
  return /\bLINK_ORDER\b/i.test(footerText);
};

/**
 * Buat URL link cek order resmi (mengarah ke domain VITE_PUBLIC_TRACKING_URL/c/...)
 */
export const getReceiptTrackingUrl = (invoiceId) => {
  if (!invoiceId) return '';
  return getTrackingUrl(invoiceId, DEFAULT_TRACKING_DOMAIN);
};

/**
 * Membersihkan keyword saklar (LINK_ORDER, INVOICE, BARCODE) dari teks footer
 * agar tidak tercetak sebagai teks mentah pada struk.
 */
export const cleanReceiptFooterText = (footerText) => {
  if (!footerText) return '';
  return String(footerText)
    .replace(/\{?\[?(?:LINK_ORDER|INVOICE|BARCODE)\]?\}?/gi, '')
    .replace(/^\s*[\r\n]/gm, '')
    .trim();
};

/**
 * Format teks footer:
 * - Jika ada kata LINK_ORDER: diganti dengan link cek order lengkap
 * - Jika ada kata INVOICE / BARCODE: dibersihkan dari teks karena akan dirender sebagai Barcode SVG
 */
export const formatReceiptFooterText = (footerText, invoiceId, options = {}) => {
  if (!footerText) return '';
  let formatted = String(footerText);

  // Jika opsi eksplisit meminta teks bersih (misal untuk pemisahan target cetak)
  if (options.cleanOnly || options.target === 'pdf' || options.target === 'thermal') {
    return cleanReceiptFooterText(formatted);
  }

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


