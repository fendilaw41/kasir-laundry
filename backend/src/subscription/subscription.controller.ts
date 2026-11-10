import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import {
  PlanPaymentService,
  CreatePlanPaymentDto,
} from './plan-payment.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { SubscriptionPlan } from '@prisma/client';

@ApiTags('Subscription')
@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly planPaymentService: PlanPaymentService,
  ) {}

  @Public()
  @Get('plans')
  @ApiOperation({
    summary: 'Mendapatkan daftar paket dan batas limit dari database',
  })
  async getPlans() {
    const plans = await this.subscriptionService.getAllPlans();
    const plansMap: Record<string, any> = {};
    for (const p of plans) {
      plansMap[p.key] = p;
    }
    return {
      success: true,
      plans,
      plansMap,
    };
  }

  @ApiBearerAuth('bearer')
  @Put('plans/:key')
  @ApiOperation({ summary: 'Update master plan di database (Khusus Owner)' })
  async updatePlan(
    @CurrentUser() user: any,
    @Param('key') key: string,
    @Body() body: any,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException(
        'Hanya akun Owner yang dapat mengubah konfigurasi master plan.',
      );
    }
    const updated = await this.subscriptionService.updateMasterPlan(key, body);
    return {
      success: true,
      message: `Konfigurasi master plan ${key} berhasil diperbarui.`,
      data: updated,
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
      throw new ForbiddenException(
        'Hanya Owner yang dapat mengubah paket langganan toko.',
      );
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
  @ApiOperation({
    summary: 'Top-up kuota tambahan transaksi atau foto (Khusus Owner)',
  })
  async topup(
    @CurrentUser() user: any,
    @Body() body: { type: 'TRANSACTIONS' | 'PHOTOS'; amount: number },
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException(
        'Hanya Owner yang dapat melakukan top-up kuota.',
      );
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

  // ==========================================
  // PAYMENT / NATIVE CHECKOUT (MAYAR.ID)
  // ==========================================

  @Public()
  @Get('payments/methods')
  @ApiOperation({
    summary: 'Mendapatkan daftar opsi metode pembayaran yang tersedia',
  })
  getSupportedPaymentMethods() {
    return {
      success: true,
      methods: this.planPaymentService.getSupportedMethods(),
    };
  }

  @ApiBearerAuth('bearer')
  @Post('payments/create')
  @ApiOperation({
    summary: 'Membuat pesanan pembayaran langganan ke Mayar (Khusus Owner)',
  })
  async createPayment(
    @CurrentUser() user: any,
    @Body() body: CreatePlanPaymentDto,
  ) {
    if (user.role !== 'owner') {
      throw new ForbiddenException(
        'Hanya Owner yang dapat membeli paket langganan.',
      );
    }
    return this.planPaymentService.createPaymentOrder(
      user.storeId,
      user.id,
      body,
    );
  }

  @ApiBearerAuth('bearer')
  @Get('payments/:orderId')
  @ApiOperation({ summary: 'Mengecek status pembayaran pesanan' })
  async getPaymentStatus(
    @CurrentUser('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    const data = await this.planPaymentService.checkOrderStatus(
      orderId,
      storeId,
    );
    return {
      success: true,
      data,
    };
  }

  @Public()
  @Post('payments/webhook/mayar/:secret')
  @ApiOperation({ summary: 'Webhook penerima event notifikasi dari Mayar.id' })
  async handleMayarWebhook(
    @Param('secret') secret: string,
    @Body() payload: any,
  ) {
    return this.planPaymentService.handleWebhook(secret, payload);
  }
}
