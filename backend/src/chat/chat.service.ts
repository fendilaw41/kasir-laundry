import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { randomUUID } from 'crypto';
import * as path from 'path';

export interface ChatUserPayload {
  userId: string;
  role: string;
  storeId: string;
  username?: string;
  fullname?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) { }

  /**
   * Mengembalikan konfigurasi chat (status lintas cabang dan storage driver)
   */
  async getConfig() {
    const enableCrossStoreChat = process.env.ENABLE_CROSS_STORE_CHAT === 'true';
    const storageDriver = this.storageService.getActiveDriverType();

    return {
      enableCrossStoreChat,
      storageDriver,
    };
  }

  /**
   * Mengambil daftar kontak pengguna dengan isolasi cabang (kasir hanya sesama toko, owner bisa multi-toko)
   */
  async getContacts(currentUser: ChatUserPayload) {
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const enableCrossStore = process.env.ENABLE_CROSS_STORE_CHAT === 'true';

    // Kasir hanya boleh melihat kontak dalam tokonya sendiri
    // Owner melihat semua cabang HANYA jika fitur ENABLE_CROSS_STORE_CHAT diaktifkan
    const whereCondition: any = {
      id: { not: currentUser.userId },
      deletedAt: null,
    };

    if (!isOwner || !enableCrossStore) {
      whereCondition.storeId = currentUser.storeId;
    }

    const users = await this.prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        username: true,
        fullname: true,
        role: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { store: { name: 'asc' } },
        { fullname: 'asc' },
      ],
    });

    return users;
  }

  /**
   * Mengambil daftar percakapan aktif pengguna beserta pesan terakhir dan unread count
   */
  async getConversations(currentUser: ChatUserPayload) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        deletedAt: null,
        members: {
          some: {
            userId: currentUser.userId,
          },
        },
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullname: true,
                role: true,
                storeId: true,
                store: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                fullname: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Hitung unread messages per percakapan untuk currentUser
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const currentMember = conv.members.find(
          (m) => m.userId === currentUser.userId,
        );
        const lastReadAt = currentMember ? currentMember.lastReadAt : new Date(0);

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            createdAt: { gt: lastReadAt },
            senderId: { not: currentUser.userId },
            deletedAt: null,
          },
        });

        // Tentukan judul dan avatar percakapan
        let displayName = conv.title;
        let displayAvatar = conv.avatarUrl;

        if (conv.type === 'DIRECT') {
          const otherMember = conv.members.find(
            (m) => m.userId !== currentUser.userId,
          );
          if (otherMember?.user) {
            displayName = otherMember.user.fullname;
          }
        }

        return {
          id: conv.id,
          type: conv.type,
          title: displayName || 'Percakapan',
          avatarUrl: displayAvatar,
          storeId: conv.storeId,
          store: conv.store,
          createdById: conv.createdById,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          members: conv.members,
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      }),
    );

    return conversationsWithUnread;
  }

  /**
   * Membuat atau mengembalikan percakapan (DIRECT, GROUP, atau CROSS_STORE)
   */
  async createConversation(currentUser: ChatUserPayload, dto: CreateConversationDto) {
    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const enableCrossStore = process.env.ENABLE_CROSS_STORE_CHAT === 'true';

    if (dto.type === 'DIRECT') {
      return this.handleCreateDirectConversation(currentUser, dto);
    }

    if (dto.type === 'GROUP') {
      return this.handleCreateGroupConversation(currentUser, dto);
    }

    if (dto.type === 'CROSS_STORE') {
      if (!isOwner) {
        throw new ForbiddenException(
          'Hanya Owner yang memiliki izin membuat grup percakapan lintas cabang.',
        );
      }
      if (!enableCrossStore) {
        throw new ForbiddenException(
          'Fitur obrolan lintas cabang saat ini dinonaktifkan di pengaturan server.',
        );
      }
      return this.handleCreateCrossStoreConversation(currentUser, dto);
    }

    throw new BadRequestException(`Tipe percakapan tidak valid: ${dto.type}`);
  }

  /**
   * Logika pembuatan Direct Message (1-on-1)
   */
  private async handleCreateDirectConversation(
    currentUser: ChatUserPayload,
    dto: CreateConversationDto,
  ) {
    const targetUserId =
      dto.targetUserId || (dto.memberIds && dto.memberIds[0]);

    if (!targetUserId) {
      throw new BadRequestException('ID user target wajib ditentukan untuk obrolan langsung.');
    }

    if (targetUserId === currentUser.userId) {
      throw new BadRequestException('Tidak dapat memulai percakapan dengan diri sendiri.');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullname: true, storeId: true, role: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Pengguna target tidak ditemukan.');
    }

    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const enableCrossStore = process.env.ENABLE_CROSS_STORE_CHAT === 'true';

    // Kasir hanya boleh direct chat dengan pengguna sesama toko
    if (!isOwner && targetUser.storeId !== currentUser.storeId) {
      throw new ForbiddenException('Kasir hanya dapat menghubungi anggota di toko yang sama.');
    }

    // Owner hanya boleh direct chat dengan beda toko jika ENABLE_CROSS_STORE_CHAT aktif
    if (isOwner && targetUser.storeId !== currentUser.storeId && !enableCrossStore) {
      throw new ForbiddenException('Obrolan lintas cabang sedang dinonaktifkan.');
    }

    // Periksa apakah percakapan DIRECT antara kedua user ini sudah ada
    const existingConv = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        deletedAt: null,
        AND: [
          { members: { some: { userId: currentUser.userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, fullname: true, username: true, role: true, storeId: true },
            },
          },
        },
      },
    });

    if (existingConv) {
      return existingConv;
    }

    // Buat percakapan DIRECT baru
    const convStoreId =
      currentUser.storeId === targetUser.storeId ? currentUser.storeId : null;

    const newConv = await this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        storeId: convStoreId,
        createdById: currentUser.userId,
        members: {
          create: [
            { userId: currentUser.userId, role: 'admin' },
            { userId: targetUserId, role: 'member' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, fullname: true, username: true, role: true, storeId: true },
            },
          },
        },
      },
    });

    return newConv;
  }

  /**
   * Logika pembuatan Grup Toko Lokal
   */
  private async handleCreateGroupConversation(
    currentUser: ChatUserPayload,
    dto: CreateConversationDto,
  ) {
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('Nama grup wajib diisi.');
    }

    const memberIds = Array.from(new Set(dto.memberIds || []));
    if (!memberIds.includes(currentUser.userId)) {
      memberIds.push(currentUser.userId);
    }

    if (memberIds.length < 2) {
      throw new BadRequestException('Grup memerlukan minimal 2 anggota.');
    }

    // Validasi bahwa seluruh anggota berasal dari toko yang sama
    const membersInDb = await this.prisma.user.findMany({
      where: {
        id: { in: memberIds },
        deletedAt: null,
      },
      select: { id: true, storeId: true },
    });

    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const foreignMember = membersInDb.find((m) => m.storeId !== currentUser.storeId);
    if (foreignMember && !isOwner) {
      throw new ForbiddenException(
        'Grup toko hanya boleh berisi anggota dari toko yang sama.',
      );
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        title: dto.title.trim(),
        storeId: currentUser.storeId,
        createdById: currentUser.userId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === currentUser.userId ? 'admin' : 'member',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, fullname: true, username: true, role: true, storeId: true },
            },
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Logika pembuatan Grup Lintas Cabang (Owner Only)
   */
  private async handleCreateCrossStoreConversation(
    currentUser: ChatUserPayload,
    dto: CreateConversationDto,
  ) {
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('Nama grup lintas cabang wajib diisi.');
    }

    const memberIds = Array.from(new Set(dto.memberIds || []));
    if (!memberIds.includes(currentUser.userId)) {
      memberIds.push(currentUser.userId);
    }

    if (memberIds.length < 2) {
      throw new BadRequestException('Grup lintas cabang memerlukan minimal 2 anggota.');
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'CROSS_STORE',
        title: dto.title.trim(),
        storeId: null, // Cross-store tidak terikat ke 1 storeId tunggal
        createdById: currentUser.userId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === currentUser.userId ? 'admin' : 'member',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullname: true,
                username: true,
                role: true,
                storeId: true,
                store: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  /**
   * Mengambil riwayat pesan dalam suatu percakapan dengan validasi keanggotaan
   */
  async getMessages(
    conversationId: string,
    currentUser: ChatUserPayload,
    limit = 50,
    before?: string,
  ) {
    await this.assertConversationMembership(conversationId, currentUser.userId);

    const safeLimit = Math.min(Math.max(1, limit), 100);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      include: {
        sender: {
          select: {
            id: true,
            fullname: true,
            username: true,
            role: true,
            storeId: true,
          },
        },
      },
    });

    // Urutkan kembali secara ascending agar tampil urut dari lama ke baru di chat window
    return messages.reverse();
  }

  /**
   * Menyimpan pesan baru ke database (idempotent dengan client-generated UUID)
   */
  async createMessage(currentUser: ChatUserPayload, dto: CreateMessageDto) {
    if (!dto.conversationId) {
      throw new BadRequestException('conversationId wajib diisi.');
    }

    if (!dto.uuid) {
      throw new BadRequestException('uuid wajib disediakan untuk idempotency.');
    }

    await this.assertConversationMembership(dto.conversationId, currentUser.userId);

    // Cek idempotency: jika pesan dengan UUID ini sudah ada, kembalikan pesan yang ada
    const existingMessage = await this.prisma.message.findUnique({
      where: { uuid: dto.uuid },
      include: {
        sender: {
          select: {
            id: true,
            fullname: true,
            username: true,
            role: true,
            storeId: true,
          },
        },
      },
    });

    if (existingMessage) {
      return existingMessage;
    }

    // Simpan pesan baru
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          uuid: dto.uuid,
          conversationId: dto.conversationId,
          senderId: currentUser.userId,
          content: dto.content ? dto.content.trim() : null,
          type: dto.type || 'TEXT',
          imageUrl: dto.imageUrl || null,
          imageWidth: dto.imageWidth || null,
          imageHeight: dto.imageHeight || null,
          fileSize: dto.fileSize || null,
          status: 'SENT',
          metadata: (dto.metadata as any) ?? undefined,
        },
        include: {
          sender: {
            select: {
              id: true,
              fullname: true,
              username: true,
              role: true,
              storeId: true,
            },
          },
        },
      });

      // Update waktu percakapan
      await tx.conversation.update({
        where: { id: dto.conversationId },
        data: { updatedAt: new Date() },
      });

      // Tandai lastReadAt pengirim
      await tx.conversationMember.updateMany({
        where: {
          conversationId: dto.conversationId,
          userId: currentUser.userId,
        },
        data: { lastReadAt: new Date() },
      });

      return created;
    });

    return message;
  }

  /**
   * Menandai percakapan telah dibaca oleh currentUser
   */
  async markAsRead(conversationId: string, currentUser: ChatUserPayload) {
    await this.assertConversationMembership(conversationId, currentUser.userId);

    await this.prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId: currentUser.userId,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: currentUser.userId },
        status: { not: 'READ' },
        deletedAt: null,
      },
      data: {
        status: 'READ',
      },
    });

    return { success: true };
  }

  /**
   * Mengunggah file gambar chat dengan isolasi folder per toko dan penamaan terstandar
   */
  async uploadFile(
    currentUser: ChatUserPayload,
    file: Express.Multer.File,
    conversationId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Berkas foto tidak ditemukan dalam form upload.');
    }

    // Validasi batas ukuran file (maksimal 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Ukuran foto melebihi batas maksimal 5MB.');
    }

    // Validasi tipe file (hanya gambar jpeg, png, webp)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Format file tidak didukung (${file.mimetype}). Gunakan JPG, PNG, atau WEBP.`,
      );
    }

    await this.assertConversationMembership(conversationId, currentUser.userId);

    // Dapatkan ekstensi file yang aman
    const rawExt = path.extname(file.originalname).toLowerCase() || '.jpg';
    const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt)
      ? rawExt
      : '.jpg';

    // Penamaan file terstandar: {storeId}_{timestamp}_{uuid}.[ext]
    const filename = `${currentUser.storeId}_${Date.now()}_${randomUUID()}${ext}`;

    const storedResult = await this.storageService.saveFile(
      currentUser.storeId,
      filename,
      file.buffer,
      file.mimetype,
    );

    const relativeApiUrl = `/api/chat/files/${currentUser.storeId}/${filename}`;

    return {
      filename,
      storeId: currentUser.storeId,
      imageUrl: relativeApiUrl,
      fileKey: storedResult.fileKey,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  /**
   * Mengambil stream file chat dengan verifikasi hak akses toko dan percakapan
   */
  async getFileStream(
    currentUser: ChatUserPayload,
    targetStoreId: string,
    filename: string,
  ) {
    // Sanitasi pencegahan Directory Traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Nama berkas tidak valid.');
    }

    const isOwner = currentUser.role.toLowerCase() === 'owner';
    const isSameStore = currentUser.storeId === targetStoreId;

    // Jika bukan owner dan bukan dari toko yang sama, periksa apakah pengguna berada dalam
    // percakapan yang memuat file ini (misal dalam percakapan CROSS_STORE yang dibuat oleh owner)
    if (!isSameStore && !isOwner) {
      const fileAccessAllowed = await this.verifyCrossStoreFileAccess(
        currentUser.userId,
        targetStoreId,
        filename,
      );
      if (!fileAccessAllowed) {
        throw new ForbiddenException(
          'Akses ditolak: Anda tidak memiliki izin untuk mengunduh berkas ini.',
        );
      }
    }

    return this.storageService.getFileStream(targetStoreId, filename);
  }

  /**
   * Verifikasi apakah user tergabung dalam percakapan yang memuat pesan foto target
   */
  private async verifyCrossStoreFileAccess(
    userId: string,
    storeId: string,
    filename: string,
  ): Promise<boolean> {
    const fileSearchPattern = `${storeId}/${filename}`;
    const matchingMessage = await this.prisma.message.findFirst({
      where: {
        imageUrl: { contains: fileSearchPattern },
        deletedAt: null,
        conversation: {
          members: {
            some: { userId },
          },
        },
      },
      select: { id: true },
    });

    return !!matchingMessage;
  }

  /**
   * Memastikan bahwa user adalah anggota sah dari percakapan
   */
  private async assertConversationMembership(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Akses ditolak: Anda bukan anggota dari percakapan ini.',
      );
    }
  }
}
