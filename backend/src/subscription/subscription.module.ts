import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { MayarClientService } from './mayar-client.service';
import { PlanPaymentService } from './plan-payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../common/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, MayarClientService, PlanPaymentService],
  exports: [SubscriptionService, MayarClientService, PlanPaymentService],
})
export class SubscriptionModule {}
