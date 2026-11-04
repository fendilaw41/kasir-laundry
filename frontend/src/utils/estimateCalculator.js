/**
 * Utility untuk menghitung estimasi hari pengerjaan cucian secara otomatis
 * berdasarkan nama layanan / paket yang ada di keranjang.
 */

/**
 * Mengekstrak estimasi hari pengerjaan dari satu item.
 * Jika berupa rentang (misal "Reguler (2-3 hari)"), diambil nilai terlama/maksimal (3).
 *
 * @param {Object} item - Objek item dari cart atau product
 * @returns {number} Jumlah hari pengerjaan
 */
export function parseItemEstimatedDays(item) {
  if (!item) return 0;

  // 1. Jika item memiliki field eksplisit 'estimasi' atau 'estimateDays'
  if (typeof item.estimasi === 'number' && !isNaN(item.estimasi) && item.estimasi > 0) {
    return item.estimasi;
  }
  if (typeof item.estimateDays === 'number' && !isNaN(item.estimateDays) && item.estimateDays > 0) {
    return item.estimateDays;
  }

  const text = `${item.name || ''} ${item.description || ''} ${item.category || ''}`;
  if (!text.trim()) return 0;

  // 2. Format rentang hari: misal "2-3 hari", "2 - 3 Hari", "2–3 hari", "3-4 hr"
  const rangeMatch = text.match(/(\d+)\s*[-–—]\s*(\d+)\s*(?:hari|hr)\b/i);
  if (rangeMatch) {
    const num1 = parseInt(rangeMatch[1], 10);
    const num2 = parseInt(rangeMatch[2], 10);
    return Math.max(num1, num2);
  }

  // 3. Format hari tunggal: misal "1 Hari", "2 hari", "3hr"
  const singleDayMatch = text.match(/(\d+)\s*(?:hari|hr)\b/i);
  if (singleDayMatch) {
    return parseInt(singleDayMatch[1], 10);
  }

  // 4. Format jam: misal "4 Jam", "8 Jam", "24 jam"
  const hourMatch = text.match(/(\d+)\s*jam\b/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return Math.max(1, Math.ceil(hours / 24));
  }

  // 5. Fallback berbasis kata kunci jika tidak ada angka
  const lower = text.toLowerCase();
  if (lower.includes('reguler')) {
    return 3;
  }
  if (lower.includes('express') || lower.includes('kilat') || lower.includes('pagi sore')) {
    return 1;
  }

  return 0;
}

/**
 * Menghitung estimasi hari pengerjaan untuk seluruh item di keranjang.
 * Selalu mengambil nilai maksimal (durasi pengerjaan terlama) di antara semua item.
 *
 * Contoh:
 * - 10 item "Cuci Lipat Reguler (2-3 hari)" -> 3 hari
 * - Campuran 1 item "Express (1 Hari)" + 1 item "Reguler (2-3 hari)" -> 3 hari
 * - Campuran "Express (1 Hari)" + "Bed Cover (3-4 hari)" -> 4 hari
 *
 * @param {Array} cartItems - Daftar item dalam keranjang
 * @returns {number} Estimasi hari terlama (maksimal)
 */
export function calculateOrderEstimatedDays(cartItems) {
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return 0;
  }

  let maxDays = 0;
  for (const item of cartItems) {
    const days = parseItemEstimatedDays(item);
    if (days > maxDays) {
      maxDays = days;
    }
  }

  return maxDays;
}

