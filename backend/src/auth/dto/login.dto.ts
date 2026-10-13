import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ description: 'Kode Toko / Store Code (opsional jika username unik global)', example: 'STORE01' })
  storeCode?: string;

  @ApiProperty({ description: 'Username kasir/owner', example: 'owner' })
  username: string;

  @ApiProperty({ description: 'Password plaintext', example: 'password123' })
  password: string;

  @ApiPropertyOptional({ description: 'ID Toko (opsional, UUID)', example: 'store-uuid-001' })
  storeId?: string;
}
