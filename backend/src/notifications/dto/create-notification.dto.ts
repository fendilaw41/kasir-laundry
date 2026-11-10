import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID toko terkait', example: 'store_123' })
  storeId: string;

  @ApiProperty({ description: 'Judul notifikasi', example: 'Transaksi Baru' })
  title: string;

  @ApiProperty({ description: 'Isi ringkas notifikasi', example: 'Order #TRX-101 telah dibuat.' })
  message: string;

  @ApiProperty({
    description: 'Tipe notifikasi',
    example: 'TRANSACTION',
    enum: ['TRANSACTION', 'STOCK_APPROVED', 'PLAN_UPGRADE', 'LOW_STOCK'],
  })
  type: 'TRANSACTION' | 'STOCK_APPROVED' | 'PLAN_UPGRADE' | 'LOW_STOCK' | string;

  @ApiPropertyOptional({ description: 'Tautan detail', example: '/order/12' })
  link?: string;

  @ApiPropertyOptional({ description: 'Role target (jika spesifik)', example: 'owner' })
  role?: 'owner' | 'kasir';

  @ApiPropertyOptional({ description: 'User target spesifik (opsional)', example: 'user_123' })
  userId?: string;
}
