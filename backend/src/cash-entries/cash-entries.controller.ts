import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CashEntriesService } from './cash-entries.service';
import { SyncCashDto } from './dto/sync-cash.dto';

@ApiTags('Cash Entries')
@ApiBearerAuth('bearer')
@ApiResponse({ status: 401, description: 'Unauthorized - Token JWT diperlukan.' })
@Controller('cash-entries')
export class CashEntriesController {
  constructor(private readonly service: CashEntriesService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar Entri Buku Kas',
    description: 'Menarik daftar catatan kas untuk toko/store aktif, mendukung filter waktu perubahan (since).',
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'Waktu perubahan ISO 8601 untuk sinkronisasi diferensial / inkremental',
    example: '2026-11-16T00:00:00.000Z',
  })
  @ApiResponse({ status: 200, description: 'Daftar entri kas berhasil diambil.' })
  list(@Req() req: any, @Query('since') since?: string) {
    return this.service.list(req.user.storeId, since);
  }

  @Post('sync')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Sinkronisasi Entri Buku Kas',
    description: 'Upsert massal idempotent untuk sinkronisasi offline-first klien.',
  })
  @ApiBody({ type: SyncCashDto })
  @ApiResponse({ status: 201, description: 'Entri kas berhasil disinkronkan.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Hanya owner yang boleh mengubah/menghapus catatan kas yang sudah ada.' })
  sync(@Req() req: any, @Body() dto: SyncCashDto) {
    return this.service.sync(req.user.storeId, req.user.role, dto);
  }
}
