import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get()
  @ApiOperation({ summary: 'Ambil 5 notifikasi terbaru toko sesuai hak akses role' })
  async getLatest(@CurrentUser() user: any) {
    const storeId = user.storeId;
    const role = user.role;
    return this.notificationsService.findLatest(storeId, role, 5);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Tandai seluruh notifikasi toko sebagai telah dibaca' })
  async markAllRead(@CurrentUser() user: any) {
    const storeId = user.storeId;
    const role = user.role;
    await this.notificationsService.markAllAsRead(storeId, role);
    return { success: true };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Tandai notifikasi telah dibaca' })
  async markRead(@CurrentUser() user: any, @Param('id') id: string) {
    const storeId = user.storeId;
    await this.notificationsService.markAsRead(storeId, id);
    return { success: true };
  }
}

