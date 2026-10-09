import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { SyncOrderDto } from './dto/sync-order.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Endpoint sinkronisasi satu pesanan dari frontend
   * POST /orders/sync
   */
  @Post('sync')
  @ApiOperation({
    summary: 'Sinkronisasi Single Order (Upsert Idempotent)',
    description: 'Menyimpan atau memperbarui data satu pesanan dari client offline-first ke backend database.',
  })
  @ApiBody({ type: SyncOrderDto })
  @ApiResponse({ status: 201, description: 'Order berhasil disinkronkan.' })
  @ApiResponse({ status: 400, description: 'Payload data order tidak valid.' })
  async syncOrder(@Body() dto: SyncOrderDto) {
    const data = await this.ordersService.syncOrder(dto);
    return {
      success: true,
      message: 'Order berhasil disinkronkan',
      data,
    };
  }

  /**
   * Endpoint sinkronisasi banyak pesanan (batch)
   * POST /orders/sync-batch
   */
  @Post('sync-batch')
  @ApiOperation({
    summary: 'Sinkronisasi Batch Orders',
    description: 'Menyinkronkan daftar antrean pesanan yang belum ter-sync saat aplikasi offline.',
  })
  @ApiBody({ type: [SyncOrderDto] })
  @ApiResponse({ status: 201, description: 'Batch order berhasil diproses.' })
  async syncBatch(@Body() dtos: SyncOrderDto[]) {
    const results = await this.ordersService.syncBatchOrders(dtos);
    return {
      success: true,
      message: 'Batch sync selesai diproses',
      results,
    };
  }

  /**
   * Mengambil daftar seluruh pesanan
   * GET /orders
   */
  @Get()
  @ApiOperation({
    summary: 'Mendapatkan Semua Daftar Order',
    description: 'Mengambil daftar seluruh pesanan laundry beserta relasi item dan pelanggan.',
  })
  @ApiQuery({ name: 'storeId', required: false, description: 'ID Toko (opsional)' })
  @ApiResponse({ status: 200, description: 'Daftar order berhasil dimuat.' })
  async findAll(@Query('storeId') storeId?: string) {
    const data = await this.ordersService.findAll(storeId);
    return {
      success: true,
      data,
    };
  }

  /**
   * Mengambil detail pesanan by ID
   * GET /orders/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Mendapatkan Detail Order Berdasarkan ID',
    description: 'Mengambil satu rincian transaksi order laundry berdasarkan ID UUID.',
  })
  @ApiParam({ name: 'id', description: 'ID UUID dari Order', example: 'c3f81e69-0268-4a94-bfbe-d45e12f672fa' })
  @ApiResponse({ status: 200, description: 'Detail order ditemukan.' })
  @ApiResponse({ status: 404, description: 'Order tidak ditemukan.' })
  async findOne(@Param('id') id: string) {
    const data = await this.ordersService.findOne(id);
    return {
      success: true,
      data,
    };
  }
}

