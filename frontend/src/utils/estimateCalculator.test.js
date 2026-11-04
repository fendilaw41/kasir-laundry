import { describe, it, expect } from 'vitest';
import { parseItemEstimatedDays, calculateOrderEstimatedDays } from './estimateCalculator';

describe('estimateCalculator', () => {
  describe('parseItemEstimatedDays', () => {
    it('mengambil nilai terlama dari rentang hari seperti "Reguler (2-3 hari)"', () => {
      expect(parseItemEstimatedDays({ name: 'Reguler (2-3 hari)' })).toBe(3);
      expect(parseItemEstimatedDays({ name: 'CUCI LIPAT - Reguler (2-3 hari)' })).toBe(3);
      expect(parseItemEstimatedDays({ name: 'CUCI SETRIKA - Reguler (2 - 3 Hari)' })).toBe(3);
      expect(parseItemEstimatedDays({ name: 'Bed Cover (3-4 hari)' })).toBe(4);
      expect(parseItemEstimatedDays({ name: 'Sepatu (4-5 hr)' })).toBe(5);
    });

    it('mengambil nilai untuk hari tunggal seperti "Express (1 Hari)"', () => {
      expect(parseItemEstimatedDays({ name: 'Express (1 Hari)' })).toBe(1);
      expect(parseItemEstimatedDays({ name: 'Cuci Kering 2 hari' })).toBe(2);
      expect(parseItemEstimatedDays({ name: 'Karpet 5 Hari' })).toBe(5);
    });

    it('mengonversi jam menjadi minimal 1 hari', () => {
      expect(parseItemEstimatedDays({ name: 'Pagi Sore (8 Jam)' })).toBe(1);
      expect(parseItemEstimatedDays({ name: 'Kilat (4 Jam)' })).toBe(1);
      expect(parseItemEstimatedDays({ name: 'Layanan 36 jam' })).toBe(2);
    });

    it('fallback ke kata kunci jika tidak ada angka hari/jam', () => {
      expect(parseItemEstimatedDays({ name: 'Cuci Komplit Reguler' })).toBe(3);
      expect(parseItemEstimatedDays({ name: 'Cuci Express' })).toBe(1);
      expect(parseItemEstimatedDays({ name: 'Layanan Kilat' })).toBe(1);
    });

    it('mengembalikan nilai eksplisit item.estimasi jika ada', () => {
      expect(parseItemEstimatedDays({ name: 'Custom', estimasi: 5 })).toBe(5);
    });

    it('mengembalikan 0 untuk item tanpa durasi yang dikenali', () => {
      expect(parseItemEstimatedDays({ name: 'Parfum Botol' })).toBe(0);
      expect(parseItemEstimatedDays(null)).toBe(0);
    });
  });

  describe('calculateOrderEstimatedDays', () => {
    it('menghitung otomatis 3 hari jika ada 10 item paket cuci Reguler (2-3 hari)', () => {
      const tenRegulerItems = Array.from({ length: 10 }).map((_, i) => ({
        id: i + 1,
        name: 'CUCI LIPAT - Reguler (2-3 hari)',
        quantity: 1,
        price: 5000,
      }));

      const result = calculateOrderEstimatedDays(tenRegulerItems);
      expect(result).toBe(3);
    });

    it('mengambil estimasi maksimal terlama di antara item-item berbeda', () => {
      const mixedItems = [
        { name: 'CUCI LIPAT - Express (1 Hari)', quantity: 2 },
        { name: 'CUCI SETRIKA - Reguler (2-3 hari)', quantity: 5 },
        { name: 'BED COVER - Spesial (3-4 hari)', quantity: 1 },
      ];

      const result = calculateOrderEstimatedDays(mixedItems);
      // max(1, 3, 4) = 4
      expect(result).toBe(4);
    });

    it('mengembalikan 0 jika keranjang kosong atau null', () => {
      expect(calculateOrderEstimatedDays([])).toBe(0);
      expect(calculateOrderEstimatedDays(null)).toBe(0);
    });
  });
});

