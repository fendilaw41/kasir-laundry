import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Status pengerjaan order (Antrean, Proses, Selesai, Ambil, Dibatalkan)',
    example: 'Selesai',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Catatan pelanggan tambahan (opsional)',
    example: 'Jangan pakai pewangi',
  })
  catatan?: string;

  @ApiPropertyOptional({
    description: 'Catatan internal kasir tambahan (opsional)',
    example: 'Baju ada noda luntur di kerah',
  })
  catatanKasir?: string;
}

