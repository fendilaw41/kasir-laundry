import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterStoreDto {
  @ApiProperty({ description: 'Kode Toko unik (misal: STORE02)', example: 'STORE02' })
  code: string;

  @ApiProperty({ description: 'Nama Laundry / Toko', example: 'Laundry Bersih' })
  name: string;

  @ApiPropertyOptional({ description: 'Alamat lengkap toko', example: 'Jl. Ahmad Yani No. 45' })
  address?: string;

  @ApiPropertyOptional({ description: 'Kota toko', example: 'Karawang' })
  city?: string;

  @ApiProperty({ description: 'Nomor WhatsApp / HP', example: '081234567890' })
  phone: string;

  @ApiProperty({ description: 'Password otorisasi admin / bypass', example: 'Developer2026#' })
  password: string;
}

