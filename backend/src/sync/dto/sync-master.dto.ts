import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncUserDto {
  @ApiProperty({ description: 'ID User UUID dari client', example: 'user-uuid-001' })
  id: string;

  @ApiPropertyOptional({ description: 'ID Toko (Store UUID)', example: 'store-uuid-001' })
  storeId?: string;

  @ApiProperty({ description: 'Username unik per toko', example: 'kasir1' })
  username: string;

  @ApiProperty({ description: 'Password hash bcrypt', example: '$2a$10$...' })
  password: string;

  @ApiProperty({ description: 'Nama lengkap user/kasir', example: 'Budi Kasir' })
  fullname: string;

  @ApiProperty({ description: 'Role user: owner | kasir', example: 'kasir' })
  role: string;

  @ApiPropertyOptional({ description: 'Waktu pembuatan di client', example: '2026-10-09T07:20:00.000Z' })
  createdAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu update di client', example: '2026-10-09T07:20:00.000Z' })
  updatedAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu soft delete', example: null, nullable: true })
  deletedAt?: string | Date | null;
}

export class SyncProductDto {
  @ApiProperty({ description: 'ID Produk UUID dari client', example: 'prod-uuid-001' })
  id: string;

  @ApiPropertyOptional({ description: 'ID Toko (Store UUID)', example: 'store-uuid-001' })
  storeId?: string;

  @ApiPropertyOptional({ description: 'Kode produk', example: 'CLR' })
  code?: string;

  @ApiPropertyOptional({ description: 'Kategori produk', example: 'CUCI LIPAT' })
  category?: string;

  @ApiProperty({ description: 'Nama layanan/produk', example: 'Reguler (2-3 hari)' })
  name: string;

  @ApiProperty({ description: 'Harga layanan', example: 5000 })
  price: number;

  @ApiPropertyOptional({ description: 'Waktu pembuatan di client', example: '2026-10-09T07:20:00.000Z' })
  createdAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu update di client', example: '2026-10-09T07:20:00.000Z' })
  updatedAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu soft delete', example: null, nullable: true })
  deletedAt?: string | Date | null;
}

export class SyncPelangganDto {
  @ApiProperty({ description: 'ID Pelanggan UUID dari client', example: 'pel-uuid-001' })
  id: string;

  @ApiPropertyOptional({ description: 'ID Toko (Store UUID)', example: 'store-uuid-001' })
  storeId?: string;

  @ApiProperty({ description: 'Nama Pelanggan', example: 'Budi' })
  nama: string;

  @ApiProperty({ description: 'Nomor HP Pelanggan', example: '081234567890' })
  hp: string;

  @ApiPropertyOptional({ description: 'Alamat Pelanggan', example: 'Jl. Merdeka' })
  alamat?: string;

  @ApiPropertyOptional({ description: 'Waktu pembuatan di client', example: '2026-10-09T07:20:00.000Z' })
  createdAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu update di client', example: '2026-10-09T07:20:00.000Z' })
  updatedAt?: string | Date;

  @ApiPropertyOptional({ description: 'Waktu soft delete', example: null, nullable: true })
  deletedAt?: string | Date | null;
}

export class SyncSettingsDto {
  @ApiPropertyOptional({ description: 'ID Toko (Store UUID)', example: 'store-uuid-001' })
  storeId?: string;

  @ApiPropertyOptional({ description: 'Nama Laundry', example: 'KASIR LAUNDRY' })
  namaLaundry?: string;

  @ApiPropertyOptional({ description: 'Motto Laundry', example: 'Cepat & Bersih' })
  motto?: string;

  @ApiPropertyOptional({ description: 'Alamat', example: 'Jl. Imam Bonjol 007' })
  alamat?: string;

  @ApiPropertyOptional({ description: 'Kota', example: 'KARAWANG' })
  kota?: string;

  @ApiPropertyOptional({ description: 'Nomor Telepon', example: '087853131099' })
  telepon?: string;

  @ApiPropertyOptional({ description: 'Jam Buka Operasional', example: '08.00 - 17.00' })
  jamBuka?: string;

  @ApiPropertyOptional({ description: 'Status Menerima Cucian', example: true, default: true })
  menerimaCucian?: boolean;

  @ApiPropertyOptional({ description: 'Header Struk Cetak', example: 'Terima kasih atas kunjungan anda' })
  headerStruk?: string;

  @ApiPropertyOptional({ description: 'Footer Struk Cetak', example: 'kasirlaundry.my.id' })
  footerStruk?: string;

  @ApiPropertyOptional({ description: 'Waktu update di client', example: '2026-10-09T07:20:00.000Z' })
  updatedAt?: string | Date;
}

export class SyncMasterDataDto {
  @ApiPropertyOptional({ description: 'Daftar user yang perlu di-sync', type: [SyncUserDto] })
  users?: SyncUserDto[];

  @ApiPropertyOptional({ description: 'Daftar produk/layanan yang perlu di-sync', type: [SyncProductDto] })
  products?: SyncProductDto[];

  @ApiPropertyOptional({ description: 'Daftar pelanggan yang perlu di-sync', type: [SyncPelangganDto] })
  pelanggan?: SyncPelangganDto[];

  @ApiPropertyOptional({ description: 'Data setting outlet yang perlu di-sync', type: SyncSettingsDto })
  settings?: SyncSettingsDto;
}
