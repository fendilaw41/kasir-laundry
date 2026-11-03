/**
 * Helper utilitas untuk normalisasi status pembayaran:
 * - QRIS -> 'Lunas QRIS'
 * - Cash / Tunai -> 'Lunas Cash'
 * - Deposit -> 'Lunas Deposit'
 * - Transfer -> 'Lunas Transfer'
 * - Default -> 'Lunas Cash'
 */

export const getStatusLunasByMetode = (metodeBayar) => {
  const m = String(metodeBayar || '').trim().toLowerCase();
  if (m === 'qris') return 'Lunas QRIS';
  if (m === 'deposit') return 'Lunas Deposit';
  if (m === 'transfer') return 'Lunas Transfer';
  return 'Lunas Cash';
};

/**
 * Mengecek apakah status pembayaran tergolong lunas
 * (Lunas, Lunas QRIS, Lunas Cash, Lunas Deposit, Lunas Transfer, dll)
 */
export const isStatusLunas = (statusBayar) => {
  if (!statusBayar) return false;
  const s = String(statusBayar).trim().toLowerCase();
  return s === 'lunas' || s.startsWith('lunas ') || s.startsWith('lunas-');
};

