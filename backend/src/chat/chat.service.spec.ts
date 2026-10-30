import { Test, TestingModule } from '@nestjs/testing';
import { ChatService, ChatUserPayload } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let storageService: any;

  const mockKasirUser: ChatUserPayload = {
    userId: 'user-kasir-1',
    role: 'kasir',
    storeId: 'store-a',
    username: 'kasir_a',
    fullname: 'Kasir Cabang A',
  };

  const mockOwnerUser: ChatUserPayload = {
    userId: 'user-owner-1',
    role: 'owner',
    storeId: 'store-a',
    username: 'owner_boss',
    fullname: 'Owner Toko',
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      conversation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      conversationMember: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      message: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    storageService = {
      getActiveDriverType: jest.fn().mockReturnValue('local'),
      saveFile: jest.fn(),
      getFileStream: jest.fn(),
      deleteFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    process.env.ENABLE_CROSS_STORE_CHAT = 'false';
  });

  describe('getConfig', () => {
    it('harus mengembalikan konfigurasi enableCrossStoreChat dan storageDriver', async () => {
      process.env.ENABLE_CROSS_STORE_CHAT = 'true';
      const config = await service.getConfig();
      expect(config.enableCrossStoreChat).toBe(true);
      expect(config.storageDriver).toBe('local');
    });
  });

  describe('getContacts', () => {
    it('harus membatasi kontak kasir hanya pada storeId miliknya', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-kasir-2', storeId: 'store-a', fullname: 'Kasir 2' },
      ]);

      const contacts = await service.getContacts(mockKasirUser);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            storeId: 'store-a',
            id: { not: 'user-kasir-1' },
          }),
        }),
      );
      expect(contacts).toHaveLength(1);
    });

    it('harus mengizinkan owner melihat semua store jika ENABLE_CROSS_STORE_CHAT aktif', async () => {
      process.env.ENABLE_CROSS_STORE_CHAT = 'true';
      prisma.user.findMany.mockResolvedValue([]);

      await service.getContacts(mockOwnerUser);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            storeId: 'store-a',
          }),
        }),
      );
    });
  });

  describe('createConversation', () => {
    it('harus menolak jika kasir mencoba direct chat ke cabang lain', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-b',
        storeId: 'store-b',
        fullname: 'Kasir Toko B',
        role: 'kasir',
      });

      await expect(
        service.createConversation(mockKasirUser, {
          type: 'DIRECT',
          targetUserId: 'user-b',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus menolak jika kasir mencoba membuat grup CROSS_STORE', async () => {
      await expect(
        service.createConversation(mockKasirUser, {
          type: 'CROSS_STORE',
          title: 'Grup Lintas Cabang',
          memberIds: ['user-kasir-1', 'user-b'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus menolak jika owner membuat grup CROSS_STORE tapi fitur di env dinonaktifkan', async () => {
      process.env.ENABLE_CROSS_STORE_CHAT = 'false';
      await expect(
        service.createConversation(mockOwnerUser, {
          type: 'CROSS_STORE',
          title: 'Grup Lintas Cabang',
          memberIds: ['user-owner-1', 'user-b'],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus mengembalikan percakapan DIRECT jika sudah ada (idempotent)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-a2',
        storeId: 'store-a',
        fullname: 'Kasir Toko A 2',
        role: 'kasir',
      });

      const mockExisting = { id: 'conv-exist-123', type: 'DIRECT' };
      prisma.conversation.findFirst.mockResolvedValue(mockExisting);

      const result = await service.createConversation(mockKasirUser, {
        type: 'DIRECT',
        targetUserId: 'user-a2',
      });

      expect(result).toBe(mockExisting);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });
  });

  describe('createMessage', () => {
    it('harus menolak pengiriman pesan jika user bukan anggota percakapan', async () => {
      prisma.conversationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.createMessage(mockKasirUser, {
          uuid: 'msg-uuid-1',
          conversationId: 'conv-unknown',
          content: 'Halo',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('harus idempotent: jika UUID pesan sudah ada, kembalikan pesan yang ada tanpa insert baru', async () => {
      prisma.conversationMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      const existingMsg = { id: 'msg-db-1', uuid: 'msg-uuid-1', content: 'Halo' };
      prisma.message.findUnique.mockResolvedValue(existingMsg);

      const result = await service.createMessage(mockKasirUser, {
        uuid: 'msg-uuid-1',
        conversationId: 'conv-1',
        content: 'Halo',
      });

      expect(result).toBe(existingMsg);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('uploadFile', () => {
    it('harus menolak file non-gambar', async () => {
      prisma.conversationMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      const mockFile: any = {
        size: 1000,
        mimetype: 'application/pdf',
        originalname: 'dokumen.pdf',
        buffer: Buffer.from('test'),
      };

      await expect(
        service.uploadFile(mockKasirUser, mockFile, 'conv-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('harus menolak file melebihi 5MB', async () => {
      const mockFile: any = {
        size: 6 * 1024 * 1024,
        mimetype: 'image/jpeg',
        originalname: 'big.jpg',
        buffer: Buffer.from('test'),
      };

      await expect(
        service.uploadFile(mockKasirUser, mockFile, 'conv-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('harus menyimpan gambar valid dengan nama file terstandar storeId', async () => {
      prisma.conversationMember.findUnique.mockResolvedValue({ id: 'mem-1' });
      storageService.saveFile.mockResolvedValue({
        fileKey: 'key-123',
        filePathOrUrl: 'url-123',
        fileSize: 1024,
        mimeType: 'image/jpeg',
      });

      const mockFile: any = {
        size: 1024,
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
        buffer: Buffer.from('test'),
      };

      const result = await service.uploadFile(mockKasirUser, mockFile, 'conv-1');

      expect(result.storeId).toBe('store-a');
      expect(result.filename).toMatch(/^store-a_\d+_[a-z0-9-]+\.jpg$/);
      expect(storageService.saveFile).toHaveBeenCalledWith(
        'store-a',
        expect.stringMatching(/^store-a_/),
        mockFile.buffer,
        'image/jpeg',
      );
    });
  });
});

