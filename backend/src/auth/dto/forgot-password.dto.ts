import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Kode Toko unik tempat akun terdaftar', example: 'STORE01' })
  storeCode: string;

  @ApiProperty({ description: 'Username akun yang ingin direset', example: 'kasir1' })
  username: string;

  @ApiPropertyOptional({ description: 'Origin URL aplikasi frontend untuk membentuk link reset', example: 'https://kasirlaundry.my.id' })
  origin?: string;
}

