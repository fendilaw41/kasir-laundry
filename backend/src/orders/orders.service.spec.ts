import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrdersService - Public Tracking', () => {
  let service: OrdersService;
  let prisma: any;

  const mockOrder = {
    id: 'ord-uuid-12345',
    storeId: 'store-uuid-001',
    invoiceId: '8126-00001',
    status: 'Proses',
    statusBayar: 'Lunas',
    metodeBayar: 'Tunai',
    total: 50000,
    diskon: 5000,
    bayar: 50000,
    kembalian: 5000,
    estimasi: '2',
    tipeLayanan: 'Kiloan',
    isPriority: false,
    catatan: 'Harum melati',
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-01T11:00:00Z'),
    deletedAt: null,
    items: [
      {
        id: 'item-1',
        name: 'Cuci Komplit Reguler',
        quantity: 5,
        price: 10000,
        subtotal: 50000,
      },
    ],
    pelanggan: {
      id: 'pel-1',
      nama: 'Budi Santoso',
      hp: '081234567890',
      alamat: 'Jl. Merdeka No. 10',
    },
    store: {
      id: 'store-uuid-001',
      name: 'Laundry Bersih',
      address: 'Jl. Sukajadi',
      city: 'Bandung',
      phone: '081999888777',
      settings: {
        namaLaundry: 'Laundry Bersih Express',
        motto: 'Bersih, Rapi, Wangi',
        alamat: 'Jl. Sukajadi No. 12',
        kota: 'Bandung',
        telepon: '081999888777',
        jamBuka: '07.00 - 21.00',
        headerStruk: 'Terima kasih telah mempercayakan cucian Anda',
        footerStruk: 'kasirlaundry.my.id',
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('encode dan decode short tracking code secara bolak-balik', () => {
    const invoice = '8126-00001';
    const encoded = service.encodeTrackingCode(invoice);
    expect(encoded).toBeTruthy();
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('+');

    const decoded = service.decodeTrackingCode(encoded);
    expect(decoded).toBe(invoice);
  });

  it('berhasil melacak order dengan nomor nota raw invoiceId', async () => {
    prisma.order.findFirst.mockResolvedValue(mockOrder);

    const result = await service.trackPublicOrder('8126-00001');

    expect(result.invoiceId).toBe('8126-00001');
    expect(result.status).toBe('Proses');
    expect(result.statusBayar).toBe('Lunas');
    expect(result.pelanggan.nama).toBe('Budi Santoso');
    // Nomor HP harus di-mask untuk privasi publik
    expect(result.pelanggan.hp).toBe('0812****890');
    expect(result.items).toHaveLength(1);
    expect(result.store.name).toBe('Laundry Bersih Express');
  });

  it('berhasil melacak order dengan encoded shortcode', async () => {
    prisma.order.findFirst.mockResolvedValue(mockOrder);
    const shortCode = service.encodeTrackingCode('8126-00001');

    const result = await service.trackPublicOrder(shortCode);

    expect(result.invoiceId).toBe('8126-00001');
    expect(result.shortCode).toBe(shortCode);
  });

  it('melempar NotFoundException jika pesanan tidak ada', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.trackPublicOrder('TIDAK-ADA')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('melempar BadRequestException jika kode tracking kosong', async () => {
    await expect(service.trackPublicOrder('')).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('findAll', () => {
    it('memfilter deletedAt: null secara default jika includeDeleted = false', async () => {
      prisma.order.findMany = jest.fn().mockResolvedValue([]);
      await service.findAll('store-1', false);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, storeId: 'store-1' },
        include: { items: true, pelanggan: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('tidak memfilter deletedAt jika includeDeleted = true', async () => {
      prisma.order.findMany = jest.fn().mockResolvedValue([]);
      await service.findAll('store-1', true);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { storeId: 'store-1' },
        include: { items: true, pelanggan: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
