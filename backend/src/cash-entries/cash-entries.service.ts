import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncCashDto } from './dto/sync-cash.dto';

@Injectable()
export class CashEntriesService {
  private readonly logger = new Logger(CashEntriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Tarik perubahan sejak waktu tertentu (untuk sinkronisasi klien)
  async list(storeId: string, since?: string) {
    const where: any = { storeId };
    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.updatedAt = { gt: sinceDate };
      }
    }

    const entries = await this.prisma.cashEntry.findMany({
      where,
      orderBy: { updatedAt: 'asc' },
    });

    return entries.map((e) => ({
      ...e,
      amount: Number(e.amount),
      date: e.date instanceof Date ? e.date.toISOString().split('T')[0] : e.date,
    }));
  }

  // Upsert massal, idempoten per uuid. Aturan: yang updatedAt-nya lebih baru menang.
  async sync(storeId: string, role: string, dto: SyncCashDto) {
    const saved: string[] = [];
    const normalizedRole = (role || '').trim().toLowerCase();

    for (const e of dto.entries) {
      const existing = await this.prisma.cashEntry.findUnique({
        where: { uuid: e.uuid },
      });

      if (existing && existing.storeId !== storeId) {
        // Jangan pernah menimpa data toko lain
        continue;
      }

      if (existing) {
        // Kiriman ulang (retry) yang sama persis dianggap sudah tersimpan
        if (new Date(e.updatedAt) <= existing.updatedAt) {
          saved.push(e.uuid);
          continue;
        }

        // Hanya owner yang boleh mengubah / menghapus catatan yang sudah ada
        if (normalizedRole !== 'owner') {
          throw new ForbiddenException('Hanya owner yang boleh mengubah atau menghapus catatan kas');
        }
      }

      const [y, m, d] = e.date.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d));

      await this.prisma.cashEntry.upsert({
        where: { uuid: e.uuid },
        create: {
          uuid: e.uuid,
          storeId,
          type: e.type,
          amount: BigInt(Math.round(e.amount)),
          category: e.category,
          method: e.method || 'tunai',
          note: e.note ?? null,
          date: dateObj,
          createdBy: e.createdBy ?? null,
          source: e.source || 'MANUAL',
          orderId: e.orderId ?? null,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
          deletedAt: e.deletedAt ? new Date(e.deletedAt) : null,
        },
        update: {
          type: e.type,
          amount: BigInt(Math.round(e.amount)),
          category: e.category,
          method: e.method || 'tunai',
          note: e.note ?? null,
          date: dateObj,
          createdBy: e.createdBy ?? null,
          source: e.source || 'MANUAL',
          orderId: e.orderId ?? null,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
          deletedAt: e.deletedAt ? new Date(e.deletedAt) : null,
        },
      });

      saved.push(e.uuid);
    }

    return { saved };
  }
}
