import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { MayarClientService, MayarError } from './mayar-client.service';
import { parsePaymentDetail } from './payment-parser.util';
import {
  SubscriptionPlan,
  PlanPaymentStatus,
  PlanPayment,
} from '@prisma/client';

export class CreatePlanPaymentDto {
  planKey: string;
  paymentMethod: string;
}

export interface SupportedPaymentMethod {
  code: string;
  name: string;
  type: 'QRIS' | 'VA' | 'EWALLET';
  serviceFee: number;
}

const DEFAULT_SUPPORTED_METHODS: SupportedPaymentMethod[] = [
  {
    code: 'qris',
    name: 'QRIS (Semua E-Wallet & Bank)',
    type: 'QRIS',
    serviceFee: 1000,
  },
  { code: 'va/bca', name: 'BCA Virtual Account', type: 'VA', serviceFee: 2000 },
  {
    code: 'va/mandiri',
    name: 'Mandiri Virtual Account',
    type: 'VA',
    serviceFee: 2000,
  },
  { code: 'va/bri', name: 'BRI Virtual Account', type: 'VA', serviceFee: 2000 },
  { code: 'va/bni', name: 'BNI Virtual Account', type: 'VA', serviceFee: 2000 },
  {
    code: 'va/permata',
    name: 'Permata Virtual Account',
    type: 'VA',
    serviceFee: 2000,
  },
  {
    code: 'va/cimb',
    name: 'CIMB Niaga Virtual Account',
    type: 'VA',
    serviceFee: 2000,
  },
];

@Injectable()
export class PlanPaymentService {
  private readonly logger = new Logger(PlanPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
    private readonly mayarClient: MayarClientService,
  ) { }

  /**
   * Mengembalikan daftar metode pembayaran yang didukung beserta biaya layanannya
   */
  getSupportedMethods(): SupportedPaymentMethod[] {
    const qrisFee = Number(process.env.PAYMENT_SERVICE_FEE_QRIS || 1000);
    const vaFee = Number(process.env.PAYMENT_SERVICE_FEE_VA || 2000);

    return DEFAULT_SUPPORTED_METHODS.map((m) => ({
      ...m,
      serviceFee: m.type === 'QRIS' ? qrisFee : vaFee,
    }));
  }

  /**
   * Menghitung biaya layanan berdasarkan metode pembayaran
   */
  calculateServiceFee(paymentMethod: string): number {
    const method = this.getSupportedMethods().find(
      (m) => m.code.toLowerCase() === paymentMethod.toLowerCase(),
    );
    if (method) return method.serviceFee;

    if (paymentMethod.toLowerCase() === 'qris') {
      return Number(process.env.PAYMENT_SERVICE_FEE_QRIS || 1000);
    }
    return Number(process.env.PAYMENT_SERVICE_FEE_VA || 2000);
  }

  /**
   * Membuat pesanan pembayaran paket langganan ke Mayar (Native Checkout)
   */
  async createPaymentOrder(
    storeId: string,
    userId: string,
    dto: CreatePlanPaymentDto,
  ) {
    const planKey = dto.planKey?.toUpperCase() as SubscriptionPlan;
    if (!planKey || !Object.values(SubscriptionPlan).includes(planKey)) {
      throw new BadRequestException(
        `Paket langganan '${dto.planKey}' tidak valid.`,
      );
    }

    if (planKey === SubscriptionPlan.TRIAL) {
      throw new BadRequestException(
        'Paket Trial gratis tidak memerlukan pembayaran.',
      );
    }

    // 1. Ambil detail harga paket dari database (server-owned authority)
    const masterPlan = await this.prisma.masterPlan.findUnique({
      where: { key: planKey },
    });
    const basePrice =
      masterPlan?.price ??
      (planKey === 'STARTER' ? 25000 : planKey === 'BASIC' ? 50000 : 100000);
    const planName = masterPlan?.name ?? planKey;

    // 2. Hitung biaya layanan (service fee) dan total pembayaran
    const serviceFee = this.calculateServiceFee(dto.paymentMethod);
    const totalAmount = basePrice + serviceFee;

    // 3. Ambil data store untuk customer billing & format order ID
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { users: { where: { id: userId } } },
    });
    if (!store) {
      throw new NotFoundException('Toko tidak ditemukan.');
    }

    const user = store.users[0];
    const timestamp = Date.now();
    const cleanStoreCode = (store.code || store.id.slice(0, 8)).replace(
      /[^a-zA-Z0-9]/g,
      '',
    );
    const orderId = `${cleanStoreCode}-${planKey.toLowerCase()}-${timestamp}`;

    // 4. Persistence Contract: Buat entri order di database sebelum memanggil Mayar
    const paymentRecord = await this.prisma.planPayment.create({
      data: {
        orderId,
        storeId,
        userId,
        plan: planKey,
        amount: basePrice,
        serviceFee,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        status: PlanPaymentStatus.NOT_PAID,
      },
    });

    // 5. Siapkan payload create invoice ke Mayar
    const customerName = store.name || user?.fullname || 'Pemilik Toko';
    let customerMobile = (store.phone || '').replace(/[^0-9]/g, '');
    if (!customerMobile.startsWith('08') && !customerMobile.startsWith('628')) {
      if (customerMobile.startsWith('8')) {
        customerMobile = '0' + customerMobile;
      } else {
        customerMobile = '081234567890';
      }
    }
    if (customerMobile.length < 10) {
      customerMobile = '081234567890';
    }

    const customerEmail = `${cleanStoreCode.toLowerCase()}@kasirlaundry.com`;
    const expiredAtDate = new Date(Date.now() + 60 * 60 * 1000); // 1 jam masa berlaku
    const expiredAtIso = expiredAtDate.toISOString();

    try {
      const mayarRes = await this.mayarClient.createInvoice({
        name: customerName,
        email: customerEmail,
        mobile: customerMobile,
        description: `Upgrade Paket ${planName} Toko ${store.name} (${orderId})`,
        expiredAt: expiredAtIso,
        paymentMethod: dto.paymentMethod,
        items: [
          {
            quantity: 1,
            rate: totalAmount,
            description: `Paket ${planName} (termasuk biaya layanan gateway)`,
          },
        ],
        extraData: {
          orderId,
          storeId,
          plan: planKey,
          userId,
        },
      });

      // 6. Normalisasi instrumen pembayaran (QRIS / VA)
      const parsedDetail = parsePaymentDetail(mayarRes.paymentDetail);

      // 7. Simpan detail respons Mayar ke database
      const updated = await this.prisma.planPayment.update({
        where: { id: paymentRecord.id },
        data: {
          mayarInvoiceId: mayarRes.id,
          mayarTransactionId: mayarRes.transactionId,
          paymentUrl: mayarRes.link,
          qrString: parsedDetail?.qrString || null,
          vaNumber: parsedDetail?.vaNumber || null,
          vaBank: parsedDetail?.vaBank || null,
          customerName: parsedDetail?.customerName || customerName,
          expiredAt: new Date(mayarRes.expiredAt || expiredAtDate.getTime()),
        },
      });

      return {
        success: true,
        data: {
          orderId: updated.orderId,
          plan: updated.plan,
          planName,
          amount: updated.amount,
          serviceFee: updated.serviceFee,
          totalAmount: updated.totalAmount,
          paymentMethod: updated.paymentMethod,
          status: updated.status,
          qrString: updated.qrString,
          vaNumber: updated.vaNumber,
          vaBank: updated.vaBank,
          customerName: updated.customerName,
          paymentUrl: updated.paymentUrl,
          expiredAt: updated.expiredAt,
        },
      };
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Layanan sedang sibuk.';
      this.logger.error(
        `Gagal membuat invoice di Mayar untuk order ${orderId}: ${errorMsg}`,
      );

      // Rollback entri PlanPayment di database jika gagal membuat invoice ke Mayar
      try {
        await this.prisma.planPayment.delete({
          where: { id: paymentRecord.id },
        });
        this.logger.log(
          `Berhasil rollback PlanPayment id ${paymentRecord.id} (${orderId})`,
        );
      } catch (deleteErr: unknown) {
        const delMsg =
          deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
        this.logger.warn(
          `Gagal rollback PlanPayment id ${paymentRecord.id}: ${delMsg}`,
        );
      }

      if (err instanceof MayarError && err.statusCode === 429) {
        throw new BadRequestException(
          'Permintaan duplicate terdeteksi. Silakan tunggu 1 menit sebelum mencoba lagi.',
        );
      }
      throw new BadRequestException(
        `Gagal membuat tagihan pembayaran di Mayar: ${errorMsg}`,
      );
    }
  }

  /**
   * Mengecek status pesanan pembayaran (mendukung CAS Budget Claim & polling frontend)
   */
  async checkOrderStatus(orderId: string, storeId: string) {
    const order = await this.prisma.planPayment.findUnique({
      where: { orderId },
    });

    if (!order || order.storeId !== storeId) {
      throw new NotFoundException(`Pesanan ${orderId} tidak ditemukan.`);
    }

    if (order.status === PlanPaymentStatus.PAID) {
      return {
        orderId: order.orderId,
        status: 'PAID',
        paidAt: order.paidAt,
        plan: order.plan,
        totalAmount: order.totalAmount,
      };
    }

    // Rate budget CAS: jangan panggil Mayar jika baru saja dicek kurang dari 10 detik lalu
    const MIN_READ_GAP_MS = 10 * 1000;
    const now = new Date();
    if (
      order.lastCheckedAt &&
      now.getTime() - order.lastCheckedAt.getTime() < MIN_READ_GAP_MS
    ) {
      return {
        orderId: order.orderId,
        status: order.status,
        plan: order.plan,
        totalAmount: order.totalAmount,
      };
    }

    // Tandai stamp CAS sebelum memanggil Mayar
    await this.prisma.planPayment.update({
      where: { id: order.id },
      data: { lastCheckedAt: now },
    });

    // Jika memiliki transactionId Mayar, verifikasi status langsung ke Mayar
    if (order.mayarTransactionId) {
      try {
        const trx = await this.mayarClient.getTransactionDetail(
          order.mayarTransactionId,
        );
        if (trx?.status?.toLowerCase() === 'paid') {
          await this.settlePayment(order.mayarTransactionId, order);
          return {
            orderId: order.orderId,
            status: 'PAID',
            paidAt: now,
            plan: order.plan,
            totalAmount: order.totalAmount,
          };
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Gagal membaca status transaksi ${order.mayarTransactionId} dari Mayar: ${msg}`,
        );
      }
    }

    return {
      orderId: order.orderId,
      status: order.status,
      plan: order.plan,
      totalAmount: order.totalAmount,
    };
  }

  /**
   * Atomic Idempotent Settlement: Memvalidasi transaksi sah dan memperbarui paket toko
   */
  async settlePayment(
    transactionId: string,
    candidateOrder?: PlanPayment | null,
  ) {
    if (!transactionId) return;

    // 1. Atomic claim di tabel PaymentDelivery menggunakan lease lock 60 detik
    const lockExpiry = new Date(Date.now() + 60 * 1000);
    const existingDelivery = await this.prisma.paymentDelivery.findUnique({
      where: { transactionId },
    });

    if (existingDelivery?.status === 'completed') {
      this.logger.log(
        `Transaksi ${transactionId} sudah selesai diproses sebelumnya (idempotent skipped).`,
      );
      return;
    }

    if (
      existingDelivery?.status === 'processing' &&
      existingDelivery.lockedUntil &&
      existingDelivery.lockedUntil > new Date()
    ) {
      this.logger.log(
        `Transaksi ${transactionId} sedang diproses worker lain (lock active).`,
      );
      return;
    }

    await this.prisma.paymentDelivery.upsert({
      where: { transactionId },
      create: {
        transactionId,
        status: 'processing',
        lockedUntil: lockExpiry,
      },
      update: {
        status: 'processing',
        lockedUntil: lockExpiry,
        attemptCount: { increment: 1 },
      },
    });

    try {
      // 2. Verifikasi status transaksi dari Mayar: HANYA status 'paid' yang diizinkan
      const trx = await this.mayarClient.getTransactionDetail(transactionId);
      if (trx?.status?.toLowerCase() !== 'paid') {
        this.logger.warn(
          `Transaksi ${transactionId} status bukan 'paid' (${trx?.status}), settlement dihentikan.`,
        );
        await this.prisma.paymentDelivery.update({
          where: { transactionId },
          data: { status: 'failed', lastError: `Status is ${trx?.status}` },
        });
        return;
      }

      // 3. Cari entri pesanan PlanPayment yang bersangkutan
      const extraOrderId =
        typeof trx.extraData === 'object' &&
          trx.extraData !== null &&
          'orderId' in trx.extraData
          ? String(trx.extraData.orderId)
          : '';

      const order: PlanPayment | null =
        candidateOrder ||
        (await this.prisma.planPayment.findFirst({
          where: {
            OR: [
              { mayarTransactionId: transactionId },
              { orderId: extraOrderId },
            ],
          },
        }));

      if (!order) {
        this.logger.warn(
          `Pesanan untuk transaksi ${transactionId} tidak ditemukan.`,
        );
        await this.prisma.paymentDelivery.update({
          where: { transactionId },
          data: { status: 'failed', lastError: 'Order record not found' },
        });
        return;
      }

      // 4. Update status pesanan PlanPayment menjadi PAID
      const paidAt = new Date();
      await this.prisma.planPayment.update({
        where: { id: order.id },
        data: {
          status: PlanPaymentStatus.PAID,
          paidAt,
        },
      });

      // 5. Ubah paket toko secara otomatis melalui SubscriptionService
      await this.subscriptionService.updatePlan(order.storeId, order.plan, 1);

      // 6. Tandai PaymentDelivery sebagai completed
      await this.prisma.paymentDelivery.update({
        where: { transactionId },
        data: {
          status: 'completed',
          completedAt: paidAt,
          lockedUntil: null,
        },
      });

      this.logger.log(
        `Settlement sukses: Toko ${order.storeId} berhasil di-upgrade ke paket ${order.plan}`,
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Error saat settlement transaksi ${transactionId}: ${errorMsg}`,
      );
      await this.prisma.paymentDelivery.update({
        where: { transactionId },
        data: {
          status: 'failed',
          lastError: errorMsg,
          lockedUntil: null,
        },
      });
      throw err;
    }
  }

  /**
   * Webhook ingress handler dengan proteksi URL secret token konstan
   */
  async handleWebhook(pathSecret: string, payload: Record<string, unknown>) {
    const configuredSecret = process.env.MAYAR_WEBHOOK_TOKEN || '';
    if (!configuredSecret) {
      throw new ForbiddenException('Webhook token server belum dikonfigurasi.');
    }

    // Constant-time comparison untuk mencegah timing attack
    const incomingBuffer = Buffer.from(String(pathSecret || ''));
    const secretBuffer = Buffer.from(configuredSecret);

    if (
      incomingBuffer.length !== secretBuffer.length ||
      !crypto.timingSafeEqual(incomingBuffer, secretBuffer)
    ) {
      this.logger.warn('Akses webhook ditolak: Secret token tidak cocok.');
      throw new NotFoundException(); // Jawab 404 pada mismatch sesuai spesifikasi payment.md
    }

    const event =
      typeof payload.event === 'string'
        ? payload.event
        : typeof payload.type === 'string'
          ? payload.type
          : '';

    const data =
      typeof payload.data === 'object' && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : {};

    const transactionId =
      typeof data.transactionId === 'string'
        ? data.transactionId
        : typeof data.id === 'string'
          ? data.id
          : typeof payload.paymentLinkTransactionId === 'string'
            ? String(payload.paymentLinkTransactionId)
            : null;

    this.logger.log(
      `Webhook Mayar diterima [event: ${event}, trx: ${transactionId}]`,
    );

    if (event === 'payment.received' && transactionId) {
      await this.settlePayment(transactionId);
    }

    return {
      success: true,
      message: 'Webhook processed successfully',
    };
  }
}
