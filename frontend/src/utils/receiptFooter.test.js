import { describe, it, expect } from 'vitest';
import {
  isFooterBarcode,
  isFooterLinkOrder,
  cleanReceiptFooterText,
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
    expect(formatted).toContain('/c/');
    expect(formatted).toContain('kasir-laundry-frontend.onrender.com');
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

  it('cleanReceiptFooterText membersihkan token LINK_ORDER dan INVOICE dari teks pesan', () => {
    const raw = 'Simpan nota ini.\nLINK_ORDER\nINVOICE';
    expect(isFooterLinkOrder(raw)).toBe(true);
    expect(isFooterBarcode(raw)).toBe(true);
    expect(cleanReceiptFooterText(raw)).toBe('Simpan nota ini.');
  });

  it('menghasilkan URL pelacakan lengkap dengan domain https://kasir-laundry-frontend.onrender.com/c/...', () => {
    const url = getReceiptTrackingUrl(mockInvoiceId);
    expect(url.startsWith('https://kasir-laundry-frontend.onrender.com/c/')).toBe(true);
  });
});

