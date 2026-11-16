import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CashEntriesService } from './cash-entries.service';

describe('CashEntriesService', () => {
  let service: CashEntriesService;
  let prisma: any;

  const mockPrisma = {
    cashEntry: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CashEntriesService>(CashEntriesService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('harus mengembalikan entri kas terformat', async () => {
      mockPrisma.cashEntry.findMany.mockResolvedValue([
        {
          uuid: 'uuid-1',
          storeId: 'store-1',
          type: 'IN',
          amount: BigInt(50000),
          category: 'modal',
          method: 'tunai',
          note: 'Setor modal',
          date: new Date('2026-11-16'),
          createdBy: 'owner',
          source: 'MANUAL',
          orderId: null,
          createdAt: new Date('2026-11-16T10:00:00Z'),
          updatedAt: new Date('2026-11-16T10:00:00Z'),
          deletedAt: null,
        },
      ]);

      const result = await service.list('store-1');
      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(50000);
      expect(result[0].date).toBe('2026-11-16');
      expect(mockPrisma.cashEntry.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1' },
        orderBy: { updatedAt: 'asc' },
      });
    });

    it('harus memfilter berdasarkan parameter since jika ada', async () => {
      mockPrisma.cashEntry.findMany.mockResolvedValue([]);
      await service.list('store-1', '2026-11-16T00:00:00.000Z');
      expect(mockPrisma.cashEntry.findMany).toHaveBeenCalledWith({
        where: {
          storeId: 'store-1',
          updatedAt: { gt: new Date('2026-11-16T00:00:00.000Z') },
        },
        orderBy: { updatedAt: 'asc' },
      });
    });
  });

  describe('sync', () => {
    const baseEntryDto = {
      uuid: 'uuid-1',
      type: 'OUT' as const,
      amount: 25000,
      category: 'bahan',
      method: 'tunai',
      note: 'Deterjen',
      date: '2026-11-16',
      createdBy: 'kasir1',
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    };

    it('kasir boleh menambah entri kas baru', async () => {
      mockPrisma.cashEntry.findUnique.mockResolvedValue(null);
      mockPrisma.cashEntry.upsert.mockResolvedValue({});

      const result = await service.sync('store-1', 'kasir', { entries: [baseEntryDto] });
      expect(result.saved).toContain('uuid-1');
      expect(mockPrisma.cashEntry.upsert).toHaveBeenCalled();
    });

    it('kasir DITOLAK saat mencoba mengubah entri kas yang sudah ada', async () => {
      mockPrisma.cashEntry.findUnique.mockResolvedValue({
        uuid: 'uuid-1',
        storeId: 'store-1',
        updatedAt: new Date('2026-11-16T09:00:00.000Z'),
      });

      await expect(
        service.sync('store-1', 'kasir', {
          entries: [{ ...baseEntryDto, updatedAt: '2026-11-16T10:00:00.000Z' }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('owner boleh mengubah entri kas yang sudah ada', async () => {
      mockPrisma.cashEntry.findUnique.mockResolvedValue({
        uuid: 'uuid-1',
        storeId: 'store-1',
        updatedAt: new Date('2026-11-16T09:00:00.000Z'),
      });
      mockPrisma.cashEntry.upsert.mockResolvedValue({});

      const result = await service.sync('store-1', 'owner', {
        entries: [{ ...baseEntryDto, updatedAt: '2026-11-16T10:00:00.000Z' }],
      });
      expect(result.saved).toContain('uuid-1');
    });

    it('retry dengan updatedAt lama dianggap sudah tersimpan tanpa memanggil upsert', async () => {
      mockPrisma.cashEntry.findUnique.mockResolvedValue({
        uuid: 'uuid-1',
        storeId: 'store-1',
        updatedAt: new Date('2026-11-16T10:00:00.000Z'),
      });

      const result = await service.sync('store-1', 'kasir', {
        entries: [{ ...baseEntryDto, updatedAt: '2026-11-16T10:00:00.000Z' }],
      });
      expect(result.saved).toContain('uuid-1');
      expect(mockPrisma.cashEntry.upsert).not.toHaveBeenCalled();
    });
  });
});
