import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncMasterDataDto, SyncPelangganDto, SyncProductDto, SyncSettingsDto, SyncUserDto } from './dto/sync-master.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Mendapatkan atau mendaftarkan Store murni dari data yang dikirim oleh Frontend
   */
  async getOrCreateStoreFromClient(
    storeId: string,
    storeInfo?: { name?: string; address?: string; city?: string; phone?: string },
  ) {
    if (!storeId) {
      throw new BadRequestException('storeId wajib dikirim dari client Frontend!');
    }

    try {
      return await this.prisma.store.upsert({
        where: { id: storeId },
        update: {
          ...(storeInfo?.name ? { name: storeInfo.name } : {}),
          ...(storeInfo?.address !== undefined ? { address: storeInfo.address } : {}),
          ...(storeInfo?.city !== undefined ? { city: storeInfo.city } : {}),
          ...(storeInfo?.phone !== undefined ? { phone: storeInfo.phone } : {}),
        },
        create: {
          id: storeId,
          name: storeInfo?.name || 'Laundry Store',
          address: storeInfo?.address || null,
          city: storeInfo?.city || null,
          phone: storeInfo?.phone || null,
        },
      });
    } catch (err: any) {
      // Jika terjadi P2002 / UniqueConstraintViolation karena request paralel bersamaan
      const existing = await this.prisma.store.findUnique({ where: { id: storeId } });
      if (existing) {
        if (storeInfo?.name || storeInfo?.address || storeInfo?.city || storeInfo?.phone) {
          return await this.prisma.store.update({
            where: { id: storeId },
            data: {
              ...(storeInfo?.name ? { name: storeInfo.name } : {}),
              ...(storeInfo?.address !== undefined ? { address: storeInfo.address } : {}),
              ...(storeInfo?.city !== undefined ? { city: storeInfo.city } : {}),
              ...(storeInfo?.phone !== undefined ? { phone: storeInfo.phone } : {}),
            },
          });
        }
        return existing;
      }
      throw err;
    }
  }

  /**
   * Upsert Users dari Dexie ke PostgreSQL dengan pencatatan audit log
   */
  async upsertUsers(users: SyncUserDto[], fallbackStoreId?: string) {
    if (!users || users.length === 0) return [];

    const results = [];
    for (const u of users) {
      const storeId = u.storeId || fallbackStoreId;
      if (!storeId) {
        throw new BadRequestException(`storeId wajib disertakan untuk user ${u.username}`);
      }
      const store = await this.getOrCreateStoreFromClient(storeId);

      // Ambil data sebelum berubah
      const beforeUser = await this.prisma.user.findUnique({ where: { id: u.id } });

      const createdAt = u.createdAt ? new Date(u.createdAt) : new Date();
      const updatedAt = u.updatedAt ? new Date(u.updatedAt) : new Date();
      const deletedAt = u.deletedAt ? new Date(u.deletedAt) : null;

      const userData = {
        storeId: store.id,
        username: u.username,
        password: u.password,
        fullname: u.fullname || u.username,
        role: u.role || 'kasir',
        createdAt,
        updatedAt,
        deletedAt,
      };

      const user = await this.prisma.user.upsert({
        where: { id: u.id },
        update: userData,
        create: {
          id: u.id,
          ...userData,
        },
      });

      // Simpan log perubahan
      const action = !beforeUser ? 'CREATE' : u.deletedAt ? 'DELETE' : 'UPDATE';
      await this.prisma.syncLog.create({
        data: {
          storeId: store.id,
          tableName: 'User',
          action,
          recordId: user.id,
          username: u.username,
          beforeData: beforeUser ? JSON.parse(JSON.stringify(beforeUser)) : null,
          afterData: JSON.parse(JSON.stringify(user)),
        },
      });

      results.push(user);
    }
    return results;
  }

  /**
   * Upsert Products dari Dexie ke PostgreSQL dengan pencatatan audit log
   */
  async upsertProducts(products: SyncProductDto[], fallbackStoreId?: string) {
    if (!products || products.length === 0) return [];

    const results = [];
    for (const p of products) {
      const storeId = p.storeId || fallbackStoreId;
      if (!storeId) {
        throw new BadRequestException(`storeId wajib disertakan untuk produk ${p.name}`);
      }
      const store = await this.getOrCreateStoreFromClient(storeId);

      // Ambil data sebelum berubah
      const beforeProduct = await this.prisma.product.findUnique({ where: { id: p.id } });

      const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
      const updatedAt = p.updatedAt ? new Date(p.updatedAt) : new Date();
      const deletedAt = p.deletedAt ? new Date(p.deletedAt) : null;

      const productData = {
        storeId: store.id,
        code: p.code || null,
        category: p.category || null,
        name: p.name,
        price: Number(p.price) || 0,
        createdAt,
        updatedAt,
        deletedAt,
      };

      const product = await this.prisma.product.upsert({
        where: { id: p.id },
        update: productData,
        create: {
          id: p.id,
          ...productData,
        },
      });

      // Simpan log perubahan
      const action = !beforeProduct ? 'CREATE' : p.deletedAt ? 'DELETE' : 'UPDATE';
      await this.prisma.syncLog.create({
        data: {
          storeId: store.id,
          tableName: 'Product',
          action,
          recordId: product.id,
          username: 'owner',
          beforeData: beforeProduct ? JSON.parse(JSON.stringify(beforeProduct)) : null,
          afterData: JSON.parse(JSON.stringify(product)),
        },
      });

      results.push(product);
    }
    return results;
  }

  /**
   * Upsert Settings & Store murni dari data Frontend dengan pencatatan audit log
   */
  async upsertSettings(dto: SyncSettingsDto) {
    if (!dto) return null;
    if (!dto.storeId) {
      throw new BadRequestException('storeId wajib dikirim dari Frontend untuk sinkronisasi Settings');
    }

    const store = await this.getOrCreateStoreFromClient(dto.storeId, {
      name: dto.namaLaundry,
      address: dto.alamat,
      city: dto.kota,
      phone: dto.telepon,
    });
    const storeId = store.id;

    // Ambil data sebelum berubah
    const beforeSettings = await this.prisma.settings.findUnique({ where: { storeId } });

    const updatedAt = dto.updatedAt ? new Date(dto.updatedAt) : new Date();

    const settingsData = {
      namaLaundry: dto.namaLaundry || store.name,
      alamat: dto.alamat || store.address,
      kota: dto.kota || store.city,
      telepon: dto.telepon || store.phone,
      jamBuka: dto.jamBuka || '08.00 - 17.00',
      menerimaCucian: typeof dto.menerimaCucian === 'boolean' ? dto.menerimaCucian : true,
      headerStruk: dto.headerStruk || null,
      footerStruk: dto.footerStruk || null,
      updatedAt,
    };

    const afterSettings = await this.prisma.settings.upsert({
      where: { storeId },
      update: settingsData,
      create: {
        storeId,
        ...settingsData,
      },
    });

    // Simpan log perubahan
    const action = !beforeSettings ? 'CREATE' : 'UPDATE';
    await this.prisma.syncLog.create({
      data: {
        storeId,
        tableName: 'Settings',
        action,
        recordId: storeId,
        username: 'owner',
        beforeData: beforeSettings ? JSON.parse(JSON.stringify(beforeSettings)) : null,
        afterData: JSON.parse(JSON.stringify(afterSettings)),
      },
    });

    return afterSettings;
  }

  /**
   * Upsert Pelanggan dari Dexie ke PostgreSQL dengan pencatatan audit log
   */
  async upsertPelanggan(pelangganList: SyncPelangganDto[], fallbackStoreId?: string) {
    if (!pelangganList || pelangganList.length === 0) return [];

    const results = [];
    for (const pel of pelangganList) {
      const storeId = pel.storeId || fallbackStoreId;
      if (!storeId) {
        this.logger.warn(`Pelanggan ID ${pel.id} diabaikan: Tidak memiliki storeId.`);
        continue;
      }
      const store = await this.getOrCreateStoreFromClient(storeId);

      const beforePelanggan = await this.prisma.pelanggan.findUnique({ where: { id: pel.id } });

      const createdAt = pel.createdAt ? new Date(pel.createdAt) : new Date();
      const updatedAt = pel.updatedAt ? new Date(pel.updatedAt) : new Date();
      const deletedAt = pel.deletedAt ? new Date(pel.deletedAt) : null;

      const pelangganData = {
        storeId: store.id,
        nama: pel.nama,
        hp: pel.hp,
        alamat: pel.alamat || null,
        createdAt,
        updatedAt,
        deletedAt,
      };

      const saved = await this.prisma.pelanggan.upsert({
        where: { id: pel.id },
        update: pelangganData,
        create: {
          id: pel.id,
          ...pelangganData,
        },
      });

      const action = !beforePelanggan ? 'CREATE' : pel.deletedAt ? 'DELETE' : 'UPDATE';
      await this.prisma.syncLog.create({
        data: {
          storeId: store.id,
          tableName: 'Pelanggan',
          action,
          recordId: saved.id,
          username: 'owner',
          beforeData: beforePelanggan ? JSON.parse(JSON.stringify(beforePelanggan)) : null,
          afterData: JSON.parse(JSON.stringify(saved)),
        },
      });

      results.push(saved);
    }
    return results;
  }

  /**
   * Upsert Master Data gabungan (Users, Products, Pelanggan, Settings)
   */
  async upsertMasterData(dto: SyncMasterDataDto) {
    const storeId = dto.settings?.storeId;
    if (!storeId) {
      throw new BadRequestException('storeId wajib disertakan pada master data dari Frontend');
    }

    await this.getOrCreateStoreFromClient(storeId, {
      name: dto.settings?.namaLaundry,
      address: dto.settings?.alamat,
      city: dto.settings?.kota,
      phone: dto.settings?.telepon,
    });

    let syncedUsers: any[] = [];
    let syncedProducts: any[] = [];
    let syncedPelanggan: any[] = [];
    let syncedSettings = null;

    if (dto.users && dto.users.length > 0) {
      syncedUsers = await this.upsertUsers(dto.users, storeId);
    }

    if (dto.products && dto.products.length > 0) {
      syncedProducts = await this.upsertProducts(dto.products, storeId);
    }

    if (dto.pelanggan && dto.pelanggan.length > 0) {
      syncedPelanggan = await this.upsertPelanggan(dto.pelanggan, storeId);
    }

    if (dto.settings) {
      syncedSettings = await this.upsertSettings({ ...dto.settings, storeId });
    }

    return {
      storeId,
      usersSynced: syncedUsers.length,
      productsSynced: syncedProducts.length,
      pelangganSynced: syncedPelanggan.length,
      settingsSynced: Boolean(syncedSettings),
    };
  }

  /**
   * Mengambil riwayat log sinkronisasi & audit trail
   */
  async getSyncLogs(params: { storeId?: string; tableName?: string; limit?: number }) {
    const where: any = {};
    if (params.storeId) where.storeId = params.storeId;
    if (params.tableName) where.tableName = params.tableName;

    return await this.prisma.syncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ? Number(params.limit) : 100,
      include: {
        store: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
