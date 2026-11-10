import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'ID User / UUID atau Username',
    example: 'd3f81e69-0268-4a94-bfbe-d45e12f672fa',
  })
  userId: string;

  @ApiProperty({ description: 'Password Lama', example: 'passwordLama123' })
  oldPassword: string;

  @ApiProperty({
    description: 'Password Baru (min 5 karakter)',
    example: 'passwordBaru123',
  })
  newPassword: string;
}
