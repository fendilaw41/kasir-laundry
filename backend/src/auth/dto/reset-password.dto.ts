import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token JWT reset password yang diterima dari link WA', example: 'eyJhbGciOi...' })
  token: string;

  @ApiProperty({ description: 'Password baru (minimal 6 karakter)', example: 'PasswordBaru123!' })
  newPassword: string;

  @ApiPropertyOptional({ description: 'Konfirmasi password baru', example: 'PasswordBaru123!' })
  confirmPassword?: string;
}

