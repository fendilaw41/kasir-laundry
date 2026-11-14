import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, normalizePhoneNumber } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SubscriptionService } from '../subscription/subscription.service';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';

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
      storeSubscription: {
        findUnique: jest.fn().mockResolvedValue({ plan: 'BASIC' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-jwt-token'), verify: jest.fn() } },
        {
          provide: SubscriptionService,
          useValue: {
            assertCanPerformAction: jest.fn().mockResolvedValue(true),
            getOrCreateSubscription: jest.fn(),
          },
        },
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
      featureSubscriptionEnabled: true,
      showUpgradeBanner: true,
      users: [{ id: 'user-1', role: 'owner' }],
      subscription: { plan: 'BASIC' },
      settings: {
        namaLaundry: 'Klinik Laundry Bersih',
        alamat: 'Jl. Melati No. 2',
        kota: 'Bandung',
        telepon: '0811111111',
      },
    });

    const result = await service.getStoreInfo('store01');
    expect(result).toEqual({
      id: 'store-1',
      code: 'STORE01',
      name: 'Klinik Laundry Bersih',
      address: 'Jl. Melati No. 2',
      city: 'Bandung',
      phone: '0811111111',
      featureSubscriptionEnabled: true,
      showUpgradeBanner: true,
      hasOwner: true,
      currentPlan: 'BASIC',
      exists: true,
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
      featureSubscriptionEnabled: true,
      showUpgradeBanner: true,
      users: [],
      subscription: null,
      settings: null,
    });

    const result = await service.getStoreInfo('STORE02');
    expect(result).toEqual({
      id: 'store-2',
      code: 'STORE02',
      name: 'Laundry Express Official',
      address: 'Jl. Sudirman',
      city: 'Surabaya',
      phone: '0822222222',
      featureSubscriptionEnabled: true,
      showUpgradeBanner: true,
      hasOwner: false,
      currentPlan: 'TRIAL',
      exists: true,
    });
  });

  describe('normalizePhoneNumber', () => {
    it('menstandarisasi format nomor HP ke 628xxx', () => {
      expect(normalizePhoneNumber('081234567890')).toBe('6281234567890');
      expect(normalizePhoneNumber('+62 812-3456-7890')).toBe('6281234567890');
      expect(normalizePhoneNumber('6281234567890')).toBe('6281234567890');
      expect(normalizePhoneNumber('81234567890')).toBe('6281234567890');
    });
  });

  describe('Anti-abuse pada register store', () => {
    it('menolak registrasi jika nomor telepon sudah terdaftar di store lain', async () => {
      prisma.store.findFirst.mockResolvedValueOnce({
        id: 'existing-store',
        name: 'Toko Lama',
        phone: '6281234567890',
      });

      await expect(
        service.register({
          storeName: 'Toko Baru',
          phone: '081234567890',
          fullname: 'Budi',
          username: 'budiowner',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          role: 'owner',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('menolak registrasi jika nama toko sudah terdaftar di store lain', async () => {
      prisma.store.findFirst
        .mockResolvedValueOnce(null) // phone check (store)
        .mockResolvedValueOnce({ id: 'existing-store-name', name: 'Toko Sama' }); // name check

      prisma.settings = { findFirst: jest.fn().mockResolvedValue(null) };

      await expect(
        service.register({
          storeName: 'Toko Sama',
          phone: '089999999999',
          fullname: 'Budi',
          username: 'budiowner2',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          role: 'owner',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('menolak registrasi jika username owner sudah terdaftar di sistem', async () => {
      prisma.store.findFirst
        .mockResolvedValueOnce(null) // phone check (store)
        .mockResolvedValueOnce(null); // name check

      prisma.settings = { findFirst: jest.fn().mockResolvedValue(null) };
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing-user', username: 'ownerlama' });

      await expect(
        service.register({
          storeName: 'Toko Unik',
          phone: '089999999999',
          fullname: 'Budi',
          username: 'ownerlama',
          password: 'Password123!',
          confirmPassword: 'Password123!',
          role: 'owner',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('forgotPassword & resetPassword', () => {
    let jwtService: any;

    beforeEach(() => {
      jwtService = (service as any).jwtService;
    });

    it('forgotPassword berhasil membuat link WA jika toko dan user valid', async () => {
      prisma.store.findFirst.mockResolvedValueOnce({
        id: 'store-1',
        code: 'STORE01',
        name: 'Laundry Berkah',
        phone: '081234567890',
        settings: { namaLaundry: 'Laundry Berkah', telepon: '081234567890' },
      });
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'usr-1',
        username: 'kasir1',
        role: 'kasir',
      });

      const res = await service.forgotPassword({
        storeCode: 'STORE01',
        username: 'kasir1',
        origin: 'https://test.com',
      });

      expect(res.storeCode).toBe('STORE01');
      expect(res.username).toBe('kasir1');
      expect(res.ownerPhone).toBe('6281234567890');
      expect(res.resetUrl).toContain('https://test.com/reset-password?token=mock-jwt-token');
      expect(res.waUrl).toContain('https://wa.me/6281234567890?text=');
    });

    it('forgotPassword melempar NotFoundException jika username tidak ditemukan', async () => {
      prisma.store.findFirst.mockResolvedValueOnce({
        id: 'store-1',
        code: 'STORE01',
        name: 'Laundry Berkah',
      });
      prisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.forgotPassword({
          storeCode: 'STORE01',
          username: 'tidakada',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('resetPassword berhasil mengupdate password jika token JWT valid', async () => {
      jwtService.verify.mockReturnValueOnce({
        sub: 'usr-1',
        username: 'kasir1',
        type: 'reset_password',
      });
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'usr-1',
        username: 'kasir1',
      });
      prisma.user.update = jest.fn().mockResolvedValueOnce({ id: 'usr-1' });

      const res = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'PasswordBaru123!',
        confirmPassword: 'PasswordBaru123!',
      });

      expect(res.username).toBe('kasir1');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr-1' },
          data: expect.objectContaining({ password: expect.any(String) }),
        }),
      );
    });

    it('resetPassword melempar BadRequestException jika konfirmasi password tidak cocok', async () => {
      await expect(
        service.resetPassword({
          token: 'valid-token',
          newPassword: 'PasswordBaru123!',
          confirmPassword: 'PasswordBeda999!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

