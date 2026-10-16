import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { SyncInventoryDto, SyncMasterDataDto, SyncPelangganDto, SyncProductDto, SyncSettingsDto, SyncUserDto } from './dto/sync-master.dto';

@ApiTags('Master Sync & Audit Logs')
@ApiBearerAuth('bearer')
@ApiResponse({ status: 401, description: 'Unauthorized - Bearer token tidak valid atau tidak disertakan.' })
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('master-data')
  @ApiOperation({
    summary: 'Sinkronisasi Master Data (Users, Products, Settings)',
    description: 'Menyinkronkan master data yang berubah atau saat inisialisasi awal ke database server (Upsert).',
  })
  @ApiBody({ type: SyncMasterDataDto })
  @ApiResponse({ status: 201, description: 'Master data berhasil disinkronkan.' })
  async syncMasterData(@Body() dto: SyncMasterDataDto) {
    const data = await this.syncService.upsertMasterData(dto);
    return {
      success: true,
      message: 'Master data berhasil disinkronkan',
      data,
    };
  }

  @Post('users')
  @ApiOperation({
    summary: 'Sinkronisasi Data Kasir / User (Upsert)',
    description: 'Menyimpan atau memperbarui daftar user/kasir dari Dexie lokal.',
  })
  @ApiBody({ type: [SyncUserDto] })
  @ApiResponse({ status: 201, description: 'Users berhasil disinkronkan.' })
  async syncUsers(@Body() dtos: SyncUserDto[]) {
    const data = await this.syncService.upsertUsers(dtos);
    return {
      success: true,
      message: `${data.length} user berhasil disinkronkan`,
      data,
    };
  }

  @Post('products')
  @ApiOperation({
    summary: 'Sinkronisasi Data Produk / Layanan (Upsert)',
    description: 'Menyimpan atau memperbarui daftar produk/layanan cucian dari Dexie lokal.',
  })
  @ApiBody({ type: [SyncProductDto] })
  @ApiResponse({ status: 201, description: 'Products berhasil disinkronkan.' })
  async syncProducts(@Body() dtos: SyncProductDto[]) {
    const data = await this.syncService.upsertProducts(dtos);
    return {
      success: true,
      message: `${data.length} produk berhasil disinkronkan`,
      data,
    };
  }

  @Post('pelanggan')
  @ApiOperation({
    summary: 'Sinkronisasi Data Pelanggan / Customer (Upsert)',
    description: 'Menyimpan atau memperbarui daftar pelanggan laundry dari Dexie lokal.',
  })
  @ApiBody({ type: [SyncPelangganDto] })
  @ApiResponse({ status: 201, description: 'Pelanggan berhasil disinkronkan.' })
  async syncPelanggan(@Body() dtos: SyncPelangganDto[]) {
    const data = await this.syncService.upsertPelanggan(dtos);
    return {
      success: true,
      message: `${data.length} pelanggan berhasil disinkronkan`,
      data,
    };
  }

  @Post('settings')
  @ApiOperation({
    summary: 'Sinkronisasi Data Pengaturan Outlet (Upsert)',
    description: 'Menyimpan atau memperbarui konfigurasi toko/outlet laundry dari Dexie lokal.',
  })
  @ApiBody({ type: SyncSettingsDto })
  @ApiResponse({ status: 201, description: 'Settings berhasil disinkronkan.' })
  async syncSettings(@Body() dto: SyncSettingsDto) {
    const data = await this.syncService.upsertSettings(dto);
    return {
      success: true,
      message: 'Pengaturan outlet berhasil disinkronkan',
      data,
    };
  }

  @Post('inventory')
  @ApiOperation({
    summary: 'Sinkronisasi Data Inventory / Stok (Upsert)',
    description: 'Menyimpan atau memperbarui daftar inventory / stok bahan dari Dexie lokal.',
  })
  @ApiBody({ type: [SyncInventoryDto] })
  @ApiResponse({ status: 201, description: 'Inventory berhasil disinkronkan.' })
  async syncInventory(@Body() dtos: SyncInventoryDto[]) {
    const data = await this.syncService.upsertInventory(dtos);
    return {
      success: true,
      message: `${data.length} item inventory berhasil disinkronkan`,
      data,
    };
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Mendapatkan Daftar Inventory Toko',
    description: 'Mengambil daftar seluruh stok bahan/inventory berdasarkan ID Toko.',
  })
  @ApiQuery({ name: 'storeId', required: true, description: 'Filter berdasarkan ID Toko' })
  @ApiResponse({ status: 200, description: 'Daftar inventory berhasil dimuat.' })
  async getInventory(@Query('storeId') storeId: string) {
    const data = await this.syncService.getInventory(storeId);
    return {
      success: true,
      data,
    };
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Melihat Riwayat Log Sinkronisasi & Audit Trail',
    description: 'Mengambil catatan riwayat perubahan data (Before & After, Table, Action, User, Store).',
  })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter berdasarkan ID Toko' })
  @ApiQuery({ name: 'tableName', required: false, description: 'Filter berdasarkan nama tabel (Order, User, Product, Settings)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Jumlah baris log (default: 100)' })
  @ApiResponse({ status: 200, description: 'Daftar audit log sinkronisasi.' })
  async getSyncLogs(
    @Query('storeId') storeId?: string,
    @Query('tableName') tableName?: string,
    @Query('limit') limit?: number,
  ) {
    const data = await this.syncService.getSyncLogs({ storeId, tableName, limit });
    return {
      success: true,
      total: data.length,
      data,
    };
  }
}
