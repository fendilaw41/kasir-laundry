import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Kode Toko / Store Code yang sudah didaftarkan', example: 'STORE01' })
  storeCode: string;

  @ApiProperty({ description: 'Nama Lengkap pengguna', example: 'Budi Santoso' })
  fullname: string;

  @ApiProperty({ description: 'Username akun', example: 'owner1' })
  username: string;

  @ApiProperty({ description: 'Password plaintext', example: 'password123' })
  password: string;

  @ApiPropertyOptional({ description: 'Role pengguna (owner / kasir)', example: 'owner', default: 'owner' })
  role?: string;
}
