import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Username kasir/owner', example: 'owner' })
  username: string;

  @ApiProperty({ description: 'Password plaintext', example: 'password123' })
  password: string;

  @ApiPropertyOptional({ description: 'ID Toko (opsional, jika multi-toko)', example: 'store-uuid-001' })
  storeId?: string;
}
