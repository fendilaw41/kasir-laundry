import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AuthService - getStoreInfo', () => {
  let service: AuthService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      store: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('harus melempar BadRequestException jika kode kosong', async () => {
    await expect(service.getStoreInfo('')).rejects.toThrow(BadRequestException);
    await expect(service.getStoreInfo('   ')).rejects.toThrow(BadRequestException);
  });

  it('harus melempar NotFoundException jika toko tidak ditemukan', async () => {
    prisma.store.findFirst.mockResolvedValue(null);
    await expect(service.getStoreInfo('STORE999')).rejects.toThrow(NotFoundException);
  });

  it('harus mengembalikan info toko dengan nama dari settings jika ada', async () => {
    prisma.store.findFirst.mockResolvedValue({
      id: 'store-1',
      code: 'STORE01',
      name: 'Cabang Utama',
      address: 'Jl. Merdeka No. 1',
      city: 'Jakarta',
      phone: '081234567890',
      settings: {
        namaLaundry: 'Klinik Laundry Bersih',
        alamat: 'Jl. Melati No. 2',
        kota: 'Bandung',
        telepon: '0811111111',
      },
    });

    const result = await service.getStoreInfo('store01');
    expect(result).toEqual({
      code: 'STORE01',
      name: 'Klinik Laundry Bersih',
      address: 'Jl. Melati No. 2',
      city: 'Bandung',
      phone: '0811111111',
    });
  });

  it('harus mengembalikan info toko dengan nama default dari store jika settings belum ada', async () => {
    prisma.store.findFirst.mockResolvedValue({
      id: 'store-2',
      code: 'STORE02',
      name: 'Laundry Express Official',
      address: 'Jl. Sudirman',
      city: 'Surabaya',
      phone: '0822222222',
      settings: null,
    });

    const result = await service.getStoreInfo('STORE02');
    expect(result).toEqual({
      code: 'STORE02',
      name: 'Laundry Express Official',
      address: 'Jl. Sudirman',
      city: 'Surabaya',
      phone: '0822222222',
    });
  });
});

