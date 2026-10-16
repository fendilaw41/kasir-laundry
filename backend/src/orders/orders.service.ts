import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncOrderDto } from './dto/sync-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Mendapatkan Store dari ID yang dikirim oleh Frontend
   */
  async getOrCreateStoreFromClient(storeId?: string) {
    if (!storeId) {
      throw new BadRequestException('storeId wajib disertakan pada data order dari Frontend');
    }

    const existing = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (existing) return existing;

    return await this.prisma.store.create({
      data: {
        id: storeId,
        code: `STORE-${storeId.substring(0, 6).toUpperCase()}`,
        name: 'Laundry Store',
      },
    });
  }

  /**
   * Sync single order (Upsert idempotent)
   */
  async syncOrder(dto: SyncOrderDto) {
    const store = await this.getOrCreateStoreFromClient(dto.storeId);
    const storeId = store.id;

    const items = dto.items || dto.cartItems || [];

    return await this.prisma.$transaction(async (tx) => {
      // 1. Handle Pelanggan jika ada
      let finalPelangganId = dto.pelangganId;

      if (dto.pelanggan && dto.pelanggan.nama) {
        if (dto.pelanggan.id) {
          const pel = await tx.pelanggan.upsert({
            where: { id: dto.pelanggan.id },
            update: {
              nama: dto.pelanggan.nama,
              hp: dto.pelanggan.hp,
              alamat: dto.pelanggan.alamat,
            },
            create: {
              id: dto.pelanggan.id,
              storeId,
              nama: dto.pelanggan.nama,
              hp: dto.pelanggan.hp,
              alamat: dto.pelanggan.alamat,
            },
          });
          finalPelangganId = pel.id;
        } else {
          // Cari by HP atau nama di store ini
          const existing = await tx.pelanggan.findFirst({
            where: { storeId, hp: dto.pelanggan.hp },
          });

          if (existing) {
            finalPelangganId = existing.id;
          } else {
            const created = await tx.pelanggan.create({
              data: {
                storeId,
                nama: dto.pelanggan.nama,
                hp: dto.pelanggan.hp,
                alamat: dto.pelanggan.alamat,
              },
            });
            finalPelangganId = created.id;
          }
        }
      }

      // 2. Handle User jika ada dan valid
      let finalUserId: string | null = null;
      if (dto.userId) {
        const userExists = await tx.user.findFirst({
          where: {
            OR: [
              { id: dto.userId },
              { username: dto.userId, storeId },
            ],
          },
        });
        if (userExists) {
          finalUserId = userExists.id;
        }
      }

      // Fallback: Jika userId tidak dikirim / tidak valid, kaitkan ke owner atau kasir aktif di toko ini
      if (!finalUserId && storeId) {
        const defaultStoreUser = await tx.user.findFirst({
          where: { storeId, deletedAt: null },
          orderBy: { role: 'asc' }, // Prioritaskan 'owner' terlebih dahulu
        });
        if (defaultStoreUser) {
          finalUserId = defaultStoreUser.id;
        }
      }

      // 3. Ambil data sebelum berubah (Before Data) untuk audit log (cek by ID atau storeId + invoiceId)
      const beforeOrder = await tx.order.findFirst({
        where: {
          OR: [
            { id: dto.id },
            { storeId, invoiceId: dto.invoiceId },
          ],
        },
        include: { items: true, pelanggan: true },
      });

      // 4. Upsert Order
      const createdAt = dto.createdAt ? new Date(dto.createdAt) : new Date();
      const updatedAt = dto.updatedAt ? new Date(dto.updatedAt) : new Date();
      const deletedAt = dto.deletedAt ? new Date(dto.deletedAt) : null;

      const orderData = {
        storeId,
        invoiceId: dto.invoiceId,
        userId: finalUserId,
        pelangganId: finalPelangganId || null,
        total: Math.max(0, parseInt(String(dto.total || 0), 10)),
        diskon: Math.max(0, parseInt(String(dto.diskon || 0), 10)),
        bayar: Math.max(0, parseInt(String(dto.bayar || 0), 10)),
        kembalian: Math.max(0, parseInt(String(dto.kembalian || 0), 10)),
        metodeBayar: dto.metodeBayar || 'Tunai',
        estimasi: dto.estimasi !== undefined && dto.estimasi !== null ? String(dto.estimasi) : null,
        tipeLayanan: dto.tipeLayanan ? String(dto.tipeLayanan) : 'AJ',
        isPriority: Boolean(dto.isPriority),
        statusBayar: dto.statusBayar ? String(dto.statusBayar) : 'Belum Bayar',
        status: dto.status ? String(dto.status) : 'Proses',
        catatan: dto.catatan ? String(dto.catatan) : null,
        inventoryUsed: dto.inventoryUsed || undefined,
        createdAt,
        updatedAt,
        deletedAt,
      };

      let order;
      if (beforeOrder) {
        order = await tx.order.update({
          where: { id: beforeOrder.id },
          data: orderData,
        });
      } else {
        order = await tx.order.create({
          data: {
            id: dto.id,
            ...orderData,
          },
        });
      }

      // 5. Upsert Order Items
      if (items && items.length > 0) {
        // Hapus item lama untuk order ini jika ada
        await tx.orderItem.deleteMany({
          where: { orderId: order.id },
        });

        // Validasi apakah productId benar-benar ada di tabel Product agar tidak melanggar foreign key constraint
        const rawProductIds = items
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id));

        const existingProducts = rawProductIds.length > 0
          ? await tx.product.findMany({
            where: { id: { in: rawProductIds } },
            select: { id: true },
          })
          : [];
        const validProductIds = new Set(existingProducts.map((p) => p.id));

        // Ambil semua produk toko untuk fallback matching nama jika productId null / belum terhubung
        const storeProducts = await tx.product.findMany({
          where: { storeId: order.storeId, deletedAt: null },
        });

        // Insert item baru
        await tx.orderItem.createMany({
          data: items.map((item) => {
            let finalProductId: string | null = null;
            let itemName = item.name || 'Layanan Laundry';

            if (item.productId && validProductIds.has(item.productId)) {
              finalProductId = item.productId;
            } else if (item.name && storeProducts.length > 0) {
              const cleanName = item.name.trim().toLowerCase();
              const matched = storeProducts.find((p) => {
                const fullName = `${p.category || ''} - ${p.name || ''}`.trim().toLowerCase();
                const spaceName = `${p.category || ''} ${p.name || ''}`.trim().toLowerCase();
                const pureName = (p.name || '').trim().toLowerCase();
                return (
                  fullName === cleanName ||
                  spaceName === cleanName ||
                  pureName === cleanName ||
                  (p.code && p.code.toLowerCase() === cleanName)
                );
              });
              if (matched) {
                finalProductId = matched.id;
                if (matched.category && !itemName.includes('-')) {
                  itemName = `${matched.category} - ${matched.name}`;
                }
              }
            }

            return {
              id: item.id || undefined,
              orderId: order.id,
              productId: finalProductId,
              name: itemName,
              quantity: Number(item.quantity) || 1,
              price: Number(item.price) || 0,
              subtotal: Number(item.subtotal) || (Number(item.quantity) || 1) * (Number(item.price) || 0),
            };
          }),
        });
      }

      const afterOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: true,
          pelanggan: true,
        },
      });

      // 6. Kurangi stok inventory jika ada inventory yang digunakan pada order baru
      if (!beforeOrder && dto.inventoryUsed && Array.isArray(dto.inventoryUsed) && dto.inventoryUsed.length > 0) {
        for (const inv of dto.inventoryUsed) {
          const qty = Number(inv.quantity) || 1;
          const targetInv = await tx.inventory.findFirst({
            where: {
              storeId,
              deletedAt: null,
              OR: [
                ...(inv.id ? [{ id: String(inv.id) }] : []),
                ...(inv.uuid ? [{ id: String(inv.uuid) }] : []),
                ...(inv.nama ? [{ nama: { equals: String(inv.nama), mode: 'insensitive' as const } }] : []),
              ],
            },
          });

          if (targetInv) {
            const newStok = Math.max(0, targetInv.stok - qty);
            await tx.inventory.update({
              where: { id: targetInv.id },
              data: { stok: newStok },
            });
          }
        }
      }

      // 7. Dapatkan username pengubah
      let actorUsername = 'system';
      if (finalUserId) {
        const u = await tx.user.findUnique({ where: { id: finalUserId } });
        if (u) actorUsername = u.username;
      }

      // 8. Simpan Log Perubahan ke SyncLog
      const action = !beforeOrder ? 'CREATE' : (dto.deletedAt ? 'DELETE' : 'UPDATE');
      await tx.syncLog.create({
        data: {
          storeId,
          tableName: 'Order',
          action,
          recordId: order.id,
          username: actorUsername,
          beforeData: beforeOrder ? JSON.parse(JSON.stringify(beforeOrder)) : null,
          afterData: afterOrder ? JSON.parse(JSON.stringify(afterOrder)) : null,
        },
      });

      return afterOrder;
    });
  }

  /**
   * Sync multiple orders (Batch Sync untuk offline queue)
   */
  async syncBatchOrders(dtos: SyncOrderDto[]) {
    const results = [];
    for (const dto of dtos) {
      try {
        const synced = await this.syncOrder(dto);
        results.push({ id: dto.id, status: 'success', data: synced });
      } catch (err: any) {
        this.logger.error(`Failed to sync order ${dto.id}: ${err.message}`);
        results.push({ id: dto.id, status: 'error', message: err.message });
      }
    }
    return results;
  }

  /**
   * Ambil semua order (opsional filter per storeId)
   */
  async findAll(storeId?: string) {
    const where: any = { deletedAt: null };
    if (storeId) {
      where.storeId = storeId;
    }
    return await this.prisma.order.findMany({
      where,
      include: {
        items: true,
        pelanggan: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ambil daftar inventory untuk store tertentu
   */
  async findInventory(storeId: string) {
    if (!storeId) return [];
    return await this.prisma.inventory.findMany({
      where: { storeId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Ambil detail order by ID
   */
  async findOne(id: string) {
    return await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        pelanggan: true,
      },
    });
  }
}
