import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updatePwaManifest, getDeferredInstallPrompt, promptPwaInstall, fetchStoreInfoByCode } from './pwaHelper';

describe('pwaHelper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.head.innerHTML = '';
    localStorage.clear();
  });

  describe('updatePwaManifest', () => {
    it('membuat link manifest dengan nama toko yang diperbarui', () => {
      updatePwaManifest('Laundry Berkah');

      const link = document.querySelector('link[rel="manifest"]');
      expect(link).not.toBeNull();
      const href = link.getAttribute('href');
      expect(href).toContain('data:application/manifest+json');

      const decoded = decodeURIComponent(href.replace('data:application/manifest+json;charset=utf-8,', ''));
      const parsed = JSON.parse(decoded);
      expect(parsed.name).toBe('Laundry Berkah');
      expect(parsed.short_name).toBe('Laundry Berkah');
      expect(localStorage.getItem('pwa_custom_store_name')).toBe('Laundry Berkah');
    });

    it('memotong short_name jika nama toko lebih dari 15 karakter', () => {
      updatePwaManifest('Laundry Super Bersih Wangi Sekali');

      const link = document.querySelector('link[rel="manifest"]');
      const href = link.getAttribute('href');
      const decoded = decodeURIComponent(href.replace('data:application/manifest+json;charset=utf-8,', ''));
      const parsed = JSON.parse(decoded);

      expect(parsed.name).toBe('Laundry Super Bersih Wangi Sekali');
      expect(parsed.short_name.length).toBeLessThanOrEqual(15);
    });

    it('tidak mengubah manifest jika storeName kosong atau undefined', () => {
      updatePwaManifest('');
      expect(document.querySelector('link[rel="manifest"]')).toBeNull();
    });
  });

  describe('fetchStoreInfoByCode', () => {
    it('mengembalikan data store dari response API jika sukses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            code: 'STORE01',
            name: 'Laundry Express',
            address: 'Jl. Melati',
          },
        }),
      });

      const res = await fetchStoreInfoByCode('STORE01');
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/store-info?code=STORE01'));
      expect(res).toEqual({
        code: 'STORE01',
        name: 'Laundry Express',
        address: 'Jl. Melati',
      });
    });

    it('mengembalikan null jika API mengembalikan status error / not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const res = await fetchStoreInfoByCode('INVALID');
      expect(res).toBeNull();
    });
  });
});

