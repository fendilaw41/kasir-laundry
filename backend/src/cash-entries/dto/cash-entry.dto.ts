import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CashEntryDto {
  @ApiProperty({ description: 'UUID unik entri kas', example: 'd3b07384-d113-4663-8a30-cf9fb7b6a1e5' })
  @IsUUID()
  uuid: string;

  @ApiProperty({ description: 'Tipe transaksi: IN atau OUT', enum: ['IN', 'OUT'] })
  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @ApiProperty({ description: 'Nominal transaksi bulat positif (Rp)', example: 25000 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: 'Kategori transaksi', example: 'bahan' })
  @IsString()
  @MaxLength(30)
  category: string;

  @ApiProperty({ description: 'Metode pembayaran', enum: ['tunai', 'qris', 'transfer'] })
  @IsIn(['tunai', 'qris', 'transfer'])
  method: string;

  @ApiPropertyOptional({ description: 'Catatan tambahan transaksi', example: 'Beli deterjen 5kg' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;

  @ApiProperty({ description: 'Tanggal transaksi (YYYY-MM-DD)', example: '2026-11-16' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiPropertyOptional({ description: 'User pembuat transaksi' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Sumber entri kas: MANUAL atau ORDER', default: 'MANUAL' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  source?: string;

  @ApiPropertyOptional({ description: 'ID Order jika terkait' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ description: 'Waktu pembuatan (ISO 8601)' })
  @IsISO8601()
  createdAt: string;

  @ApiProperty({ description: 'Waktu update terakhir (ISO 8601)' })
  @IsISO8601()
  updatedAt: string;

  @ApiPropertyOptional({ description: 'Waktu soft delete (ISO 8601)', nullable: true })
  @IsOptional()
  @IsISO8601()
  deletedAt?: string | null;
}
