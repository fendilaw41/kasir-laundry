import { describe, it, expect } from 'vitest';
import {
  isFooterBarcode,
  isFooterLinkOrder,
  formatReceiptFooterText,
  getReceiptTrackingUrl,
} from './receiptFooter';

describe('receiptFooter helper', () => {
  const mockInvoiceId = 'ET52-00001';

  it('mendeteksi LINK_ORDER dan menggantinya dengan link cek order resmi', () => {
    expect(isFooterLinkOrder('LINK_ORDER')).toBe(true);
    expect(isFooterLinkOrder('Silakan cek di: LINK_ORDER')).toBe(true);
    expect(isFooterBarcode('LINK_ORDER')).toBe(false);

    const formatted = formatReceiptFooterText('LINK_ORDER', mockInvoiceId);
    expect(formatted).toContain('https://kasirlaundry.netlify.app/c/');
  });

  it('mendeteksi INVOICE untuk menampilkan barcode dan bukan link', () => {
    expect(isFooterBarcode('INVOICE')).toBe(true);
    expect(isFooterBarcode('Simpan struk ini INVOICE')).toBe(true);
    expect(isFooterLinkOrder('INVOICE')).toBe(false);

    const formatted = formatReceiptFooterText('INVOICE', mockInvoiceId);
    // Token INVOICE dihapus dari teks karena akan dirender sebagai SVG Barcode
    expect(formatted).toBe('');
  });

  it('menangani kombinasi pesan penutup dengan INVOICE', () => {
    const raw = 'Terima kasih atas kepercayaan Anda\nINVOICE';
    expect(isFooterBarcode(raw)).toBe(true);
    expect(isFooterLinkOrder(raw)).toBe(false);

    const formatted = formatReceiptFooterText(raw, mockInvoiceId);
    expect(formatted).toBe('Terima kasih atas kepercayaan Anda');
  });

  it('menghasilkan URL pelacakan lengkap dengan domain https://kasirlaundry.netlify.app/c/...', () => {
    const url = getReceiptTrackingUrl(mockInvoiceId);
    expect(url.startsWith('https://kasirlaundry.netlify.app/c/')).toBe(true);
  });
});

