import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
              deletedAt: null,
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
          // Cari by HP (hanya jika HP valid & bukan '-') ATAU by Nama di store ini yang BELUM DIHAPUS
          const validHp = dto.pelanggan.hp && dto.pelanggan.hp !== '-' && dto.pelanggan.hp.trim().length >= 4;
          const cleanNama = dto.pelanggan.nama.trim();

          const existing = await tx.pelanggan.findFirst({
            where: {
              storeId,
              deletedAt: null,
              ...(validHp
                ? { hp: dto.pelanggan.hp.trim() }
                : { nama: { equals: cleanNama, mode: 'insensitive' } }),
            },
          });

          if (existing) {
            finalPelangganId = existing.id;
          } else {
            const created = await tx.pelanggan.create({
              data: {
                storeId,
                nama: cleanNama,
                hp: dto.pelanggan.hp || '-',
                alamat: dto.pelanggan.alamat || null,
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
          const qty = Number(inv.quantity ?? inv.qty ?? 1);
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
   * Ambil semua order (opsional filter per storeId dan includeDeleted untuk sinkronisasi tombstone)
   */
  async findAll(storeId?: string, includeDeleted: boolean = false) {
    const where: any = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
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
   * Ambil daftar produk untuk store tertentu (termasuk status deletedAt)
   */
  async findProducts(storeId: string) {
    if (!storeId) return [];
    return await this.prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
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

  /**
   * Decode URL-safe base64 tracking code atau mengembalikan kode aslinya
   */
  decodeTrackingCode(code: string): string {
    if (!code) return '';
    const trimmed = code.trim();
    try {
      let base64 = trimmed.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      if (decoded && /^[\w\s.-]+$/.test(decoded) && decoded.length >= 2 && decoded.length <= 64) {
        return decoded;
      }
    } catch {
      // Abaikan jika bukan base64, gunakan string mentah
    }
    return trimmed;
  }

  /**
   * Encode invoiceId ke dalam URL-safe short code
   */
  encodeTrackingCode(invoiceId: string): string {
    if (!invoiceId) return '';
    return Buffer.from(invoiceId).toString('base64url');
  }

  /**
   * Ambil detail publik order untuk pelacakan pelanggan tanpa login
   */
  async trackPublicOrder(code: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Kode pelacakan atau nomor nota wajib disertakan');
    }

    const decoded = this.decodeTrackingCode(code);
    const raw = code.trim();

    const candidateCodes = Array.from(
      new Set([
        decoded,
        raw,
        decoded.toUpperCase(),
        raw.toUpperCase(),
      ]),
    ).filter(Boolean);

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { invoiceId: { in: candidateCodes } },
          { id: { in: candidateCodes } },
        ],
        deletedAt: null,
      },
      include: {
        items: true,
        pelanggan: {
          select: {
            id: true,
            nama: true,
            hp: true,
            alamat: true,
          },
        },
        store: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Pesanan dengan kode nota "${code}" tidak ditemukan. Pastikan nomor nota atau link pelacakan sudah benar.`,
      );
    }

    // Mask nomor HP untuk privasi pelanggan (08123456789 -> 0812****789)
    const rawHp = order.pelanggan?.hp || '';
    const maskedHp =
      rawHp.length > 7
        ? rawHp.substring(0, 4) + '****' + rawHp.substring(rawHp.length - 3)
        : rawHp;

    const shortCode = this.encodeTrackingCode(order.invoiceId);

    return {
      id: order.id,
      storeId: order.storeId,
      invoiceId: order.invoiceId,
      shortCode,
      status: order.status || 'Baru',
      statusBayar: order.statusBayar || 'Belum Lunas',
      metodeBayar: order.metodeBayar || 'Tunai',
      total: order.total,
      diskon: order.diskon || 0,
      bayar: order.bayar || 0,
      kembalian: order.kembalian || 0,
      estimasi: order.estimasi || '2',
      tipeLayanan: order.tipeLayanan || 'Kiloan',
      isPriority: !!order.isPriority,
      catatan: order.catatan || '',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: (order.items || []).map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      pelanggan: order.pelanggan
        ? {
            id: order.pelanggan.id,
            nama: order.pelanggan.nama,
            hp: maskedHp,
            alamat: order.pelanggan.alamat || '',
          }
        : {
            nama: 'Pelanggan Umum',
            hp: '-',
            alamat: '',
          },
      store: {
        id: order.store?.id,
        name:
          order.store?.settings?.namaLaundry ||
          order.store?.name ||
          'Kasir Laundry',
        motto:
          (order.store?.settings as any)?.motto || 'Solusi Laundry Bersih & Cepat',
        address:
          order.store?.settings?.alamat || order.store?.address || '',
        city: order.store?.settings?.kota || order.store?.city || '',
        phone:
          order.store?.settings?.telepon || order.store?.phone || '',
        jamBuka: order.store?.settings?.jamBuka || '08.00 - 17.00',
        headerStruk: order.store?.settings?.headerStruk || '',
        footerStruk: order.store?.settings?.footerStruk || '',
      },
    };
  }
}
