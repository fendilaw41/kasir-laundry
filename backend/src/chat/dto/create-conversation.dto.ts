import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    enum: ['DIRECT', 'GROUP', 'CROSS_STORE'],
    description: 'Tipe percakapan (DIRECT, GROUP, atau CROSS_STORE)',
    example: 'DIRECT',
  })
  type: 'DIRECT' | 'GROUP' | 'CROSS_STORE';

  @ApiPropertyOptional({
    description: 'Judul percakapan / nama group (wajib untuk tipe GROUP dan CROSS_STORE)',
    example: 'Tim Kasir Cabang Utama',
  })
  title?: string;

  @ApiPropertyOptional({
    description: 'ID user target jika tipe percakapan adalah DIRECT',
    example: 'user-uuid-123',
  })
  targetUserId?: string;

  @ApiPropertyOptional({
    description: 'Daftar ID user anggota (untuk GROUP atau CROSS_STORE)',
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2'],
  })
  memberIds?: string[];
}

