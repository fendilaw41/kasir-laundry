import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/**
 * Standalone helper function to create a notification directly with PrismaService.
 * Can be imported anywhere without dependency injection hassle.
 */
export async function createStoreNotification(
  prisma: PrismaService,
  dto: CreateNotificationDto,
) {
  try {
    return await prisma.notification.create({
      data: {
        storeId: dto.storeId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        link: dto.link ?? null,
        role: dto.role ?? null,
        userId: dto.userId ?? null,
        isRead: false,
      },
    });
  } catch (error: any) {
    Logger.warn(`[NotificationHelper] Gagal membuat notifikasi: ${error?.message}`);
    return null;
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Buat notifikasi baru untuk toko/role tertentu
   */
  async create(dto: CreateNotificationDto) {
    return createStoreNotification(this.prisma, dto);
  }

  /**
   * Ambil notifikasi terbaru untuk toko (maksimal 5 item) sesuai role pengguna
   */
  async findLatest(storeId: string, userRole?: string, limit: number = 5) {
    const roleCondition = userRole
      ? {
          OR: [{ role: null }, { role: userRole }],
        }
      : {};

    const notifications = await this.prisma.notification.findMany({
      where: {
        storeId,
        ...roleCondition,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(Math.max(1, limit), 20),
    });

    const unreadCount = await this.prisma.notification.count({
      where: {
        storeId,
        isRead: false,
        ...roleCondition,
      },
    });

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Tandai 1 notifikasi telah dibaca
   */
  async markAsRead(storeId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        storeId,
      },
      data: {
        isRead: true,
      },
    });
  }

  /**
   * Tandai seluruh notifikasi toko sebagai telah dibaca
   */
  async markAllAsRead(storeId: string, userRole?: string) {
    const roleCondition = userRole
      ? {
          OR: [{ role: null }, { role: userRole }],
        }
      : {};

    return this.prisma.notification.updateMany({
      where: {
        storeId,
        isRead: false,
        ...roleCondition,
      },
      data: {
        isRead: true,
      },
    });
  }
}

