import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CashEntry {
  @ApiProperty({ description: 'UUID entri kas', example: 'd3b07384-d113-4663-8a30-cf9fb7b6a1e5' })
  uuid: string;

  @ApiProperty({ description: 'ID Toko (Store UUID)', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  storeId: string;

  @ApiProperty({ description: 'Tipe transaksi kas: IN (Masuk) atau OUT (Keluar)', enum: ['IN', 'OUT'] })
  type: 'IN' | 'OUT';

  @ApiProperty({ description: 'Nominal transaksi (rupiah bulat)', example: 50000 })
  amount: number;

  @ApiProperty({ description: 'Kategori pengeluaran/pemasukan', example: 'bahan' })
  category: string;

  @ApiProperty({ description: 'Metode pembayaran', default: 'tunai', enum: ['tunai', 'qris', 'transfer'] })
  method: string;

  @ApiPropertyOptional({ description: 'Catatan tambahan', example: 'Beli deterjen 5 bungkus', nullable: true })
  note: string | null;

  @ApiProperty({ description: 'Tanggal transaksi (YYYY-MM-DD)', example: '2026-11-16' })
  date: string;

  @ApiPropertyOptional({ description: 'Pembuat transaksi', example: 'owner_laundry', nullable: true })
  createdBy: string | null;

  @ApiProperty({ description: 'Asal entri transaksi (MANUAL atau ORDER)', default: 'MANUAL' })
  source: string;

  @ApiPropertyOptional({ description: 'ID order jika terkait order', nullable: true })
  orderId: string | null;

  @ApiProperty({ description: 'Waktu dibuat (ISO 8601)' })
  createdAt: Date;

  @ApiProperty({ description: 'Waktu terakhir diupdate (ISO 8601)' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Waktu soft delete (ISO 8601)', nullable: true })
  deletedAt: Date | null;
}
