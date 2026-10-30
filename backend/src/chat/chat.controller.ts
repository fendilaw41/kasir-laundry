import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { Header, Inject, forwardRef } from '@nestjs/common';
import type { ChatUserPayload } from './chat.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('config')
  @ApiOperation({
    summary: 'Ambil Konfigurasi Chat',
    description: 'Mengembalikan status fitur obrolan lintas cabang dan storage driver aktif.',
  })
  @ApiResponse({ status: 200, description: 'Konfigurasi berhasil diambil.' })
  async getConfig() {
    const config = await this.chatService.getConfig();
    return {
      success: true,
      data: config,
    };
  }

  @Get('contacts')
  @ApiOperation({
    summary: 'Ambil Daftar Kontak Member Chat',
    description: 'Kasir hanya mendapatkan member sesama toko. Owner mendapatkan member multi-cabang jika toggle aktif.',
  })
  @ApiResponse({ status: 200, description: 'Daftar kontak berhasil diambil.' })
  async getContacts(@CurrentUser() user: ChatUserPayload) {
    const contacts = await this.chatService.getContacts(user);
    return {
      success: true,
      data: contacts,
    };
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Ambil Daftar Percakapan Pengguna',
    description: 'Mengembalikan daftar percakapan aktif di mana user terdaftar sebagai anggota, beserta cuplikan pesan terakhir dan unread count.',
  })
  @ApiResponse({ status: 200, description: 'Daftar percakapan berhasil diambil.' })
  async getConversations(@CurrentUser() user: ChatUserPayload) {
    const conversations = await this.chatService.getConversations(user);
    return {
      success: true,
      data: conversations,
    };
  }

  @Post('conversations')
  @ApiOperation({
    summary: 'Buat Percakapan Baru (DIRECT, GROUP, atau CROSS_STORE)',
    description: 'Membuat percakapan langsung atau grup. Grup lintas cabang dibatasi khusus untuk Owner.',
  })
  @ApiResponse({ status: 201, description: 'Percakapan berhasil dibuat.' })
  async createConversation(
    @CurrentUser() user: ChatUserPayload,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createConversation(user, dto);
    return {
      success: true,
      message: 'Percakapan berhasil dibuat.',
      data: conversation,
    };
  }

  @Get('conversations/:id/messages')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({
    summary: 'Ambil Riwayat Pesan dalam Percakapan',
    description: 'Mengembalikan daftar pesan secara berurutan. Memerlukan keanggotaan dalam percakapan.',
  })
  @ApiResponse({ status: 200, description: 'Pesan berhasil diambil.' })
  async getMessages(
    @CurrentUser() user: ChatUserPayload,
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const messages = await this.chatService.getMessages(
      conversationId,
      user,
      parsedLimit,
      before,
    );
    return {
      success: true,
      data: messages,
    };
  }

  @Post('conversations/:id/messages')
  @ApiOperation({
    summary: 'Kirim Pesan Baru ke Percakapan',
    description: 'Menyimpan pesan baru dengan idempotency key UUID dari client.',
  })
  @ApiResponse({ status: 201, description: 'Pesan berhasil dikirim.' })
  async createMessage(
    @CurrentUser() user: ChatUserPayload,
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
  ) {
    dto.conversationId = conversationId;
    const message = await this.chatService.createMessage(user, dto);

    try {
      this.chatGateway.server
        ?.to(`conversation:${conversationId}`)
        .emit('new_message', message);
    } catch (e) {}

    return {
      success: true,
      message: 'Pesan berhasil dikirim.',
      data: message,
    };
  }

  @Post('conversations/:id/read')
  @ApiOperation({
    summary: 'Tandai Percakapan Telah Dibaca',
    description: 'Memperbarui timestamp lastReadAt untuk anggota saat membuka percakapan.',
  })
  @ApiResponse({ status: 200, description: 'Percakapan berhasil ditandai telah dibaca.' })
  async markAsRead(
    @CurrentUser() user: ChatUserPayload,
    @Param('id') conversationId: string,
  ) {
    const result = await this.chatService.markAsRead(conversationId, user);

    try {
      this.chatGateway.server
        ?.to(`conversation:${conversationId}`)
        .emit('conversation_read', {
          conversationId,
          userId: user.userId,
          readAt: new Date(),
        });
    } catch (e) {}

    return {
      success: true,
      data: result,
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Unggah Foto Chat (Kamera / File)',
    description: 'Menyimpan berkas foto dengan isolasi storeId pada storage driver aktif (Local atau S3/MinIO).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        conversationId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Foto berhasil diunggah.' })
  async uploadFile(
    @CurrentUser() user: ChatUserPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body('conversationId') conversationId: string,
  ) {
    const result = await this.chatService.uploadFile(user, file, conversationId);
    return {
      success: true,
      message: 'Foto berhasil diunggah.',
      data: result,
    };
  }

  @Get('files/:storeId/:filename')
  @ApiOperation({
    summary: 'Akses Unduh Berkas Foto Chat dengan Proteksi Akses',
    description: 'Menyajikan stream berkas gambar yang diverifikasi berdasarkan hak akses toko pengguna.',
  })
  @ApiResponse({ status: 200, description: 'Stream gambar.' })
  async getFile(
    @CurrentUser() user: ChatUserPayload,
    @Param('storeId') targetStoreId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const { stream, mimeType, contentLength } =
      await this.chatService.getFileStream(user, targetStoreId, filename);

    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');

    stream.pipe(res);
  }
}
