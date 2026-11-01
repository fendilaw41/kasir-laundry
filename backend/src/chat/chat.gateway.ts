import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService, ChatUserPayload } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';

interface AuthenticatedSocket extends Socket {
  user?: ChatUserPayload;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Menangani koneksi WebSocket baru dan autentikasi token JWT
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const authHeader =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization;

      if (!authHeader) {
        this.logger.warn(`Koneksi ditolak untuk socket ${client.id}: Token tidak ada.`);
        client.disconnect();
        return;
      }

      const rawToken = authHeader.replace(/^Bearer\s+/i, '');
      const payload = await this.jwtService.verifyAsync(rawToken, {
        secret:
          process.env.JWT_SECRET || 'kasir_laundry_super_secret_jwt_key_2026',
      });

      client.user = {
        userId: payload.userId || payload.sub,
        role: payload.role,
        storeId: payload.storeId,
        username: payload.username,
        fullname: payload.fullname,
      };

      this.logger.log(
        `Socket terhubung: ${client.id} (User: ${client.user.username}, Store: ${client.user.storeId})`,
      );
    } catch (error) {
      this.logger.warn(`Koneksi socket gagal otentikasi: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Socket terputus: ${client.id}`);
  }

  /**
   * Bergabung ke room percakapan tertentu
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId || !client.user) return;
    const roomName = `conversation:${data.conversationId}`;
    client.join(roomName);
    this.logger.debug(
      `User ${client.user?.username} bergabung ke room ${roomName}`,
    );

    // Otomatis tandai telah dibaca saat user bergabung ke room percakapan
    try {
      await this.chatService.markAsRead(data.conversationId, client.user);
      client.to(roomName).emit('conversation_read', {
        conversationId: data.conversationId,
        userId: client.user?.userId,
        readAt: new Date(),
      });
    } catch (err: any) {
      this.logger.warn(`Gagal auto-markAsRead saat join_conversation: ${err.message}`);
    }
  }

  /**
   * Keluar dari room percakapan
   */
  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data?.conversationId) return;
    const roomName = `conversation:${data.conversationId}`;
    client.leave(roomName);
    this.logger.debug(
      `User ${client.user?.username} keluar dari room ${roomName}`,
    );
  }

  /**
   * Mengirim pesan secara realtime via WebSocket
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: CreateMessageDto,
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Otentikasi diperlukan.' });
      return;
    }

    try {
      const roomName = `conversation:${dto.conversationId}`;
      const message = await this.chatService.createMessage(client.user, dto);

      // Cek apakah lawan bicara sedang aktif berada di dalam room saat ini
      let isRecipientInRoom = false;
      let recipientUserId: string | null = null;
      try {
        const roomSockets = await this.server.in(roomName).fetchSockets();
        const otherActive = roomSockets.filter(
          (s: any) => s.user && s.user.userId !== client.user?.userId,
        );
        if (otherActive.length > 0) {
          isRecipientInRoom = true;
          recipientUserId = (otherActive[0] as any).user.userId;
          await this.chatService.markAsRead(dto.conversationId, (otherActive[0] as any).user);
          message.status = 'READ';
        }
      } catch (checkErr) {}

      // Broadcast pesan baru ke seluruh anggota yang sedang di room percakapan
      this.server.to(roomName).emit('new_message', message);

      if (isRecipientInRoom && recipientUserId) {
        this.server.to(roomName).emit('conversation_read', {
          conversationId: dto.conversationId,
          userId: recipientUserId,
          readAt: new Date(),
        });
      }

      // Kirim acknowledgement khusus ke pengirim untuk konfirmasi centang 2 (terkirim)
      client.emit('message_delivered', {
        uuid: dto.uuid,
        messageId: message.id,
        status: message.status,
        createdAt: message.createdAt,
      });

      return { success: true, data: message };
    } catch (error) {
      this.logger.error(`Gagal mengirim pesan socket: ${error.message}`);
      client.emit('error', {
        uuid: dto.uuid,
        message: error.message || 'Gagal mengirim pesan.',
      });
    }
  }

  /**
   * Indikator status mengetik (typing indicator)
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    if (!client.user || !data?.conversationId) return;
    const roomName = `conversation:${data.conversationId}`;

    client.to(roomName).emit('user_typing', {
      conversationId: data.conversationId,
      userId: client.user?.userId,
      username: client.user.username,
      fullname: client.user.fullname,
      isTyping: !!data.isTyping,
    });
  }

  /**
   * Notifikasi percakapan telah dibaca
   */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.user || !data?.conversationId) return;

    try {
      await this.chatService.markAsRead(data.conversationId, client.user);
      const roomName = `conversation:${data.conversationId}`;

      client.to(roomName).emit('conversation_read', {
        conversationId: data.conversationId,
        userId: client.user?.userId,
        readAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`Gagal memproses mark_read: ${error.message}`);
    }
  }
}

