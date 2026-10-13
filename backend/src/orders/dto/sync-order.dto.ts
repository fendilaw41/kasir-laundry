import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncOrderItemDto {
  @ApiPropertyOptional({ description: 'ID item atau UUID', example: 'item-uuid-001' })
  id?: string;

  @ApiPropertyOptional({ description: 'ID produk/layanan terkait', example: 'prod-uuid-001' })
  productId?: string;

  @ApiProperty({ description: 'Nama item layanan', example: 'Cuci Lipat Reguler' })
  name: string;

  @ApiProperty({ description: 'Jumlah kuantitas (kg/satuan)', example: 5 })
  quantity: number;

  @ApiProperty({ description: 'Harga per satuan (Rp)', example: 9000 })
  price: number;

  @ApiPropertyOptional({ description: 'Subtotal harga (Rp)', example: 45000 })
  subtotal?: number;
}

export class SyncPelangganDto {
  @ApiPropertyOptional({ description: 'ID Pelanggan (UUID)', example: 'pelanggan-uuid-001' })
  id?: string;

  @ApiProperty({ description: 'Nama Pelanggan', example: 'Budi Santoso' })
  nama: string;

  @ApiProperty({ description: 'Nomor HP Pelanggan', example: '081234567890' })
  hp: string;

  @ApiPropertyOptional({ description: 'Alamat Pelanggan', example: 'Jl. Melati No. 10' })
  alamat?: string;
}

export class SyncOrderDto {
  @ApiProperty({ description: 'ID Order unik dari client (UUID)', example: 'c3f81e69-0268-4a94-bfbe-d45e12f672fa' })
  id: string;

  @ApiPropertyOptional({ description: 'ID Toko (Store UUID)', example: 'store-uuid-001' })
  storeId?: string;

  @ApiProperty({ description: 'Nomor Invoice transaksi', example: 'A1B2-00001' })
  invoiceId: string;

  @ApiPropertyOptional({ description: 'ID Kasir / User yang membuat order', example: 'user-uuid-001' })
  userId?: string;

  @ApiPropertyOptional({ description: 'ID Pelanggan terdaftar', example: 'pelanggan-uuid-001' })
  pelangganId?: string;

  @ApiPropertyOptional({ description: 'Data pelanggan baru (jika dibuat saat checkout)', type: SyncPelangganDto })
  pelanggan?: SyncPelangganDto;

  @ApiProperty({ description: 'Total tagihan akhir (setelah diskon)', example: 45000 })
  total: number;

  @ApiPropertyOptional({ description: 'Nilai potongan/diskon (Rp)', example: 5000, default: 0 })
  diskon?: number;

  @ApiPropertyOptional({ description: 'Nominal yang dibayarkan', example: 50000, default: 0 })
  bayar?: number;

  @ApiPropertyOptional({ description: 'Nominal kembalian', example: 5000, default: 0 })
  kembalian?: number;

  @ApiPropertyOptional({ description: 'Metode Pembayaran (Tunai, QRIS, Transfer, dll)', example: 'Tunai', default: 'Tunai' })
  metodeBayar?: string;

  @ApiPropertyOptional({ description: 'Estimasi pengerjaan', example: 'Besok (24 Jam)' })
  estimasi?: any;

  @ApiPropertyOptional({ description: 'Tipe Layanan (DL: Diantar / AJ: Ambil Sendiri)', example: 'AJ' })
  tipeLayanan?: string;

  @ApiPropertyOptional({ description: 'Apakah pesanan prioritas/ekspres?', example: false, default: false })
  isPriority?: boolean;

  @ApiPropertyOptional({ description: 'Status Pembayaran (Lunas, DP, Belum Bayar)', example: 'Lunas' })
  statusBayar?: string;

  @ApiPropertyOptional({ description: 'Status Pengerjaan (Proses, Selesai, Ambil)', example: 'Proses', default: 'Proses' })
  status?: string;

  @ApiPropertyOptional({ description: 'Catatan tambahan pesanan', example: 'Pakaian putih dipisah' })
  catatan?: string;

  @ApiPropertyOptional({ description: 'Daftar inventori/bahan yang digunakan', example: [{ id: 1, nama: 'Deterjen', quantity: 1 }] })
  inventoryUsed?: any;

  @ApiPropertyOptional({ description: 'Daftar layanan / item cucian', type: [SyncOrderItemDto] })
  items?: SyncOrderItemDto[];

  @ApiPropertyOptional({ description: 'Fallback array item dari cart', type: [SyncOrderItemDto] })
  cartItems?: SyncOrderItemDto[];

  @ApiPropertyOptional({ description: 'Waktu pembuatan di client (ISO string)', example: '2026-10-09T07:20:00.000Z' })
  createdAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu update di client (ISO string)', example: '2026-10-09T07:20:00.000Z' })
  updatedAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu soft delete di client jika dihapus', example: null, nullable: true })
  deletedAt?: string | Date | null;
}


