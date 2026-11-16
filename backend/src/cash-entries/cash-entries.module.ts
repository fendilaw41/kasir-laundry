import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashEntriesController } from './cash-entries.controller';
import { CashEntriesService } from './cash-entries.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashEntriesController],
  providers: [CashEntriesService],
  exports: [CashEntriesService],
})
export class CashEntriesModule {}
