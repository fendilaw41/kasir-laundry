import { Test, TestingModule } from '@nestjs/testing';
import { PlanPaymentService } from './plan-payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { MayarClientService } from './mayar-client.service';
import { SubscriptionPlan, PlanPaymentStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PlanPaymentService', () => {
  let service: PlanPaymentService;
  let prisma: any;
  let subscriptionService: any;
  let mayarClient: any;

  beforeEach(async () => {
    prisma = {
      masterPlan: {
        findUnique: jest.fn(),
      },
      store: {
        findUnique: jest.fn(),
      },
      planPayment: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      paymentDelivery: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    subscriptionService = {
      updatePlan: jest.fn(),
    };

    mayarClient = {
      createInvoice: jest.fn(),
      getTransactionDetail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanPaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: MayarClientService, useValue: mayarClient },
      ],
    }).compile();

    service = module.get<PlanPaymentService>(PlanPaymentService);
  });

  describe('calculateServiceFee', () => {
    it('should calculate QRIS fee correctly', () => {
      process.env.PAYMENT_SERVICE_FEE_QRIS = '1000';
      const fee = service.calculateServiceFee('qris');
      expect(fee).toBe(1000);
    });

    it('should calculate VA fee correctly', () => {
      process.env.PAYMENT_SERVICE_FEE_VA = '2000';
      const fee = service.calculateServiceFee('va/bca');
      expect(fee).toBe(2000);
    });
  });

  describe('createPaymentOrder', () => {
    it('should reject TRIAL plan purchase', async () => {
      await expect(
        service.createPaymentOrder('store-1', 'user-1', {
          planKey: 'TRIAL',
          paymentMethod: 'qris',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create order and add service fee to total amount', async () => {
      process.env.PAYMENT_SERVICE_FEE_VA = '2000';
      prisma.masterPlan.findUnique.mockResolvedValue({
        key: 'STARTER',
        name: 'Starter',
        price: 25000,
      });

      prisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        code: 'STR01',
        name: 'Keenan Laundry',
        phone: '08123456789',
        users: [{ id: 'user-1', fullname: 'Owner Keenan' }],
      });

      prisma.planPayment.create.mockResolvedValue({
        id: 'pay-1',
        orderId: 'STR01-starter-1234567',
        status: PlanPaymentStatus.NOT_PAID,
        amount: 25000,
        serviceFee: 2000,
        totalAmount: 27000,
      });

      mayarClient.createInvoice.mockResolvedValue({
        id: 'inv-1',
        transactionId: 'trx-1',
        link: 'https://mayar.id/pay/1',
        expiredAt: Date.now() + 3600000,
        paymentDetail: {
          type: 'VIRTUAL_ACCOUNT',
          virtual_account: {
            channel_code: 'bca',
            channel_properties: {
              virtual_account_number: '8808123456',
              customer_name: 'Keenan Laundry',
            },
          },
        },
      });

      prisma.planPayment.update.mockResolvedValue({
        orderId: 'STR01-starter-1234567',
        plan: SubscriptionPlan.STARTER,
        amount: 25000,
        serviceFee: 2000,
        totalAmount: 27000,
        paymentMethod: 'va/bca',
        status: PlanPaymentStatus.NOT_PAID,
        vaNumber: '8808123456',
        vaBank: 'BCA',
        customerName: 'Keenan Laundry',
        paymentUrl: 'https://mayar.id/pay/1',
        expiredAt: new Date(),
      });

      const res = await service.createPaymentOrder('store-1', 'user-1', {
        planKey: 'STARTER',
        paymentMethod: 'va/bca',
      });

      expect(res.success).toBe(true);
      expect(res.data.totalAmount).toBe(27000); // 25.000 + 2.000 fee
      expect(res.data.vaNumber).toBe('8808123456');
      expect(prisma.planPayment.create).toHaveBeenCalled();
      expect(mayarClient.createInvoice).toHaveBeenCalled();
    });

    it('should rollback (delete) planPayment record when createInvoice fails', async () => {
      prisma.masterPlan.findUnique.mockResolvedValue({
        key: 'STARTER',
        name: 'Starter',
        price: 25000,
      });

      prisma.store.findUnique.mockResolvedValue({
        id: 'store-1',
        code: 'STR01',
        name: 'Keenan Laundry',
        phone: '08123456789',
        users: [{ id: 'user-1', fullname: 'Owner Keenan' }],
      });

      prisma.planPayment.create.mockResolvedValue({
        id: 'pay-rollback-1',
        orderId: 'STR01-starter-1234567',
        status: PlanPaymentStatus.NOT_PAID,
      });

      prisma.planPayment.delete.mockResolvedValue({});
      mayarClient.createInvoice.mockRejectedValue(new Error('Unauthorized'));

      await expect(
        service.createPaymentOrder('store-1', 'user-1', {
          planKey: 'STARTER',
          paymentMethod: 'qris',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.planPayment.delete).toHaveBeenCalledWith({
        where: { id: 'pay-rollback-1' },
      });
    });
  });

  describe('settlePayment', () => {
    it('should skip duplicate completed deliveries (idempotency)', async () => {
      prisma.paymentDelivery.findUnique.mockResolvedValue({
        transactionId: 'trx-1',
        status: 'completed',
      });

      await service.settlePayment('trx-1');
      expect(subscriptionService.updatePlan).not.toHaveBeenCalled();
    });

    it('should verify paid transaction with Mayar and update store plan', async () => {
      prisma.paymentDelivery.findUnique.mockResolvedValue(null);
      prisma.paymentDelivery.upsert.mockResolvedValue({});
      mayarClient.getTransactionDetail.mockResolvedValue({
        id: 'trx-1',
        status: 'paid',
        extraData: { orderId: 'STR01-starter-123' },
      });
      prisma.planPayment.findFirst.mockResolvedValue({
        id: 'pay-1',
        storeId: 'store-1',
        plan: SubscriptionPlan.STARTER,
      });

      await service.settlePayment('trx-1');

      expect(prisma.planPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-1' },
          data: expect.objectContaining({ status: PlanPaymentStatus.PAID }),
        }),
      );
      expect(subscriptionService.updatePlan).toHaveBeenCalledWith(
        'store-1',
        'STARTER',
        1,
      );
      expect(prisma.paymentDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { transactionId: 'trx-1' },
          data: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });
  });

  describe('handleWebhook', () => {
    it('should reject webhook if secret token does not match', async () => {
      process.env.MAYAR_WEBHOOK_TOKEN = 'valid-super-secret-token';

      await expect(
        service.handleWebhook('wrong-token', { event: 'payment.received' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should accept valid webhook and trigger settlement', async () => {
      process.env.MAYAR_WEBHOOK_TOKEN = 'secret123';
      jest.spyOn(service, 'settlePayment').mockResolvedValue(undefined);

      const res = await service.handleWebhook('secret123', {
        event: 'payment.received',
        data: { transactionId: 'trx-999' },
      });

      expect(res.success).toBe(true);
      expect(service.settlePayment).toHaveBeenCalledWith('trx-999');
    });
  });
});
