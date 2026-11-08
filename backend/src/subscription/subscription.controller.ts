import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { getPlanLimits } from './subscription.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { SubscriptionPlan } from '@prisma/client';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Mendapatkan daftar paket dan batas limit' })
  getPlans() {
    return {
      success: true,
      plans: getPlanLimits(),
    };
  }

  @ApiBearerAuth('bearer')
  @Get('usage')
  @ApiOperation({ summary: 'Mendapatkan laporan kuota & status paket toko' })
  async getUsage(@CurrentUser('storeId') storeId: string) {
    const report = await this.subscriptionService.getUsageReport(storeId);
    return {
      success: true,
      data: report,
    };
  }

  @ApiBearerAuth('bearer')
  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade paket langganan (Khusus Owner)' })
  async upgradePlan(
    @CurrentUser() user: any,
    @Body() body: { plan: SubscriptionPlan; durationMonths?: number },
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Hanya Owner yang dapat mengubah paket langganan toko.');
    }
    const updated = await this.subscriptionService.updatePlan(
      user.storeId,
      body.plan,
      body.durationMonths || 1,
    );
    return {
      success: true,
      message: `Paket toko berhasil diubah ke ${body.plan}`,
      data: updated,
    };
  }

  @ApiBearerAuth('bearer')
  @Post('topup')
  @ApiOperation({ summary: 'Top-up kuota tambahan transaksi atau foto (Khusus Owner)' })
  async topup(
    @CurrentUser() user: any,
    @Body() body: { type: 'TRANSACTIONS' | 'PHOTOS'; amount: number },
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Hanya Owner yang dapat melakukan top-up kuota.');
    }
    const updated = await this.subscriptionService.topupQuota(
      user.storeId,
      body.type,
      body.amount,
    );
    return {
      success: true,
      message: `Top-up kuota ${body.type} sebanyak ${body.amount} berhasil ditambahkan.`,
      data: updated,
    };
  }
}

