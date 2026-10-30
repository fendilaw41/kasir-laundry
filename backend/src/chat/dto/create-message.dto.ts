import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Client-generated UUID untuk idempotency dan pencegahan pesan ganda',
    example: 'd8c7b8e2-1a2b-4c3d-8e4f-5a6b7c8d9e0f',
  })
  uuid: string;

  @ApiProperty({
    description: 'ID percakapan tujuan',
    example: 'conv-uuid-123',
  })
  conversationId: string;

  @ApiPropertyOptional({
    description: 'Konten teks pesan (opsional jika hanya mengirimkan foto)',
    example: 'Halo, pakaian nota #1234 sudah selesai dicuci.',
  })
  content?: string;

  @ApiPropertyOptional({
    enum: ['TEXT', 'IMAGE', 'ORDER_SNIPPET', 'SYSTEM'],
    default: 'TEXT',
    description: 'Tipe pesan',
    example: 'TEXT',
  })
  type?: 'TEXT' | 'IMAGE' | 'ORDER_SNIPPET' | 'SYSTEM';

  @ApiPropertyOptional({
    description: 'URL atau path file gambar jika tipe pesan IMAGE',
    example: 'uploads/chat/store-1/store-1_1720000000000_uuid.jpg',
  })
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Lebar gambar dalam pixel',
    example: 800,
  })
  imageWidth?: number;

  @ApiPropertyOptional({
    description: 'Tinggi gambar dalam pixel',
    example: 600,
  })
  imageHeight?: number;

  @ApiPropertyOptional({
    description: 'Ukuran file gambar dalam bytes',
    example: 1048576,
  })
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Metadata tambahan (misal cuplikan order/nota untuk share invoice)',
    example: { orderId: 'ord-123', orderNo: 'ORD-2026-001', amount: 50000 },
  })
  metadata?: Record<string, any>;
}

