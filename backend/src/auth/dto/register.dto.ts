import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiPropertyOptional({ description: 'Kode Toko / Store Code (opsional, jika kosong dibuat otomatis by system)', example: 'FENDI-HSY789' })
  storeCode?: string;

  @ApiPropertyOptional({ description: 'Nama Toko / Laundry (wajib jika daftar owner baru)', example: 'Laundry Berkah' })
  storeName?: string;

  @ApiPropertyOptional({ description: 'Nomor WhatsApp Owner (wajib jika daftar owner baru)', example: '08123456789' })
  phone?: string;

  @ApiProperty({ description: 'Nama Lengkap pengguna', example: 'Budi Santoso' })
  fullname: string;

  @ApiProperty({ description: 'Username akun', example: 'owner1' })
  username: string;

  @ApiProperty({ description: 'Password plaintext (min 6 karakter, ada huruf besar, kecil, dan spesial karakter)', example: 'Password123#' })
  password: string;

  @ApiPropertyOptional({ description: 'Konfirmasi password', example: 'Password123#' })
  confirmPassword?: string;

  @ApiPropertyOptional({ description: 'Role pengguna (owner / kasir)', example: 'owner', default: 'owner' })
  role?: string;
}

