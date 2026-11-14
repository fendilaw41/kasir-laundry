import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterStoreDto } from './dto/register-store.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

/**
 * Normalisasi nomor WhatsApp / HP ke format standar (E.164 tanpa tanda plus: 628xxx)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62') && (cleaned.startsWith('8') || cleaned.length >= 8)) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly subscriptionService: SubscriptionService,
  ) { }

  /**
   * Registrasi user baru (Owner atau Kasir)
   * ATURAN: Hanya boleh 1 Owner untuk 1 Store!
   */
  /**
   * Pendaftaran Store Baru (Public dengan Otorisasi Password Bypass)
   */
  async registerStore(dto: RegisterStoreDto) {
    const { code, name, address, city, phone, password, featureSubscriptionEnabled, showUpgradeBanner } = dto;

    if (!code || !name) {
      throw new BadRequestException('Kode Toko dan Nama Toko wajib diisi.');
    }

    if (password !== 'Developer2026#') {
      throw new UnauthorizedException('Password otorisasi pendaftaran tidak valid.');
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanAddress = address?.trim() || null;
    const cleanCity = city?.trim() || null;
    const cleanPhone = phone?.trim() || null;

    const subEnabled = typeof featureSubscriptionEnabled === 'boolean' ? featureSubscriptionEnabled : true;
    const bannerEnabled = typeof showUpgradeBanner === 'boolean' ? showUpgradeBanner : subEnabled;

    // Cek apakah Kode Toko sudah terdaftar
    const existing = await this.prisma.store.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      const rawPlan = (dto.plan || 'TRIAL').trim().toUpperCase();
      const targetPlan = (rawPlan === 'ENTERPRISE' ? 'BUSINESS' : rawPlan) as SubscriptionPlan;

      // Cek apakah storeSubscription sudah terdaftar untuk toko ini
      const existingSub = await this.prisma.storeSubscription.findUnique({
        where: { storeId: existing.id },
      });

      let subResult: any = null;
      if (!existingSub) {
        // Data store belum terdaftar storesubscription maka insert baru
        await this.subscriptionService.getOrCreateSubscription(existing.id);
        subResult = await this.subscriptionService.updatePlan(existing.id, targetPlan);
        this.logger.log(`StoreSubscription baru berhasil di-insert untuk store ${existing.code} dengan paket ${targetPlan}`);
      } else {
        // Jika sudah ada maka update
        subResult = await this.subscriptionService.updatePlan(existing.id, targetPlan);
        this.logger.log(`StoreSubscription store ${existing.code} berhasil diperbarui ke paket ${targetPlan}`);
      }

      const updatedStore = await this.prisma.store.update({
        where: { id: existing.id },
        data: {
          name: cleanName || existing.name,
          address: cleanAddress ?? existing.address,
          city: cleanCity ?? existing.city,
          phone: cleanPhone ?? existing.phone,
          featureSubscriptionEnabled: typeof featureSubscriptionEnabled === 'boolean' ? featureSubscriptionEnabled : existing.featureSubscriptionEnabled,
          showUpgradeBanner: typeof showUpgradeBanner === 'boolean' ? showUpgradeBanner : existing.showUpgradeBanner,
        },
      });

      return {
        message: `Paket store ${updatedStore.name} (${updatedStore.code}) berhasil diperbarui ke paket ${targetPlan}.`,
        store: updatedStore,
        subscription: subResult,
        storeSubscription: subResult,
        isPlanUpdated: true,
      };
    }

    // Buat Store & Settings dalam satu transaksi
    const result = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          code: cleanCode,
          name: cleanName,
          address: cleanAddress,
          city: cleanCity,
          phone: cleanPhone,
          featureSubscriptionEnabled: subEnabled,
          showUpgradeBanner: bannerEnabled,
        },
      });

      const settings = await tx.settings.create({
        data: {
          storeId: store.id,
          namaLaundry: cleanName,
          motto: 'Solusi Laundry Bersih & Cepat',
          alamat: cleanAddress,
          kota: cleanCity,
          telepon: cleanPhone,
          menerimaCucian: true,
          isTokoTutup: false,
          headerStruk: 'Terima kasih atas kunjungan anda',
          footerStruk: 'LINK_ORDER',
        },
      });

      return { store, settings };
    });

    // 1. Seed master data default (5 produk & 3 inventori)
    try {
      await this.seedDefaultMasterDataForStore(result.store.id);
    } catch (seedErr: any) {
      this.logger.warn(`Gagal seed default master data untuk store ${cleanCode}: ${seedErr.message}`);
    }

    // 2. Insert baru ke table storeSubscription
    const rawPlan = (dto.plan || 'TRIAL').trim().toUpperCase();
    const targetPlan = (rawPlan === 'ENTERPRISE' ? 'BUSINESS' : rawPlan) as SubscriptionPlan;
    let storeSubscription: any = null;

    try {
      await this.subscriptionService.getOrCreateSubscription(result.store.id);
      storeSubscription = await this.subscriptionService.updatePlan(result.store.id, targetPlan);
      this.logger.log(`StoreSubscription baru berhasil di-insert untuk store baru ${cleanCode} dengan paket ${targetPlan}`);
    } catch (subErr: any) {
      this.logger.warn(`Gagal membuat storeSubscription untuk store baru ${cleanCode}: ${subErr.message}`);
    }

    return {
      message: `Store ${cleanName} (${cleanCode}) berhasil didaftarkan.`,
      store: result.store,
      settings: result.settings,
      subscription: storeSubscription,
      storeSubscription,
    };
  }

  async register(dto: RegisterDto) {
    const { storeCode, storeName, phone, fullname, username, password, confirmPassword, role = 'owner' } = dto;

    if (!fullname || !username || !password) {
      throw new BadRequestException('Nama Lengkap, Username, dan Password wajib diisi.');
    }

    const cleanUsername = username.trim();
    const cleanFullname = fullname.trim();
    const normalizedRole = role.toLowerCase().trim();

    // Validasi Password: minimal 6 karakter, mengandung huruf besar, huruf kecil, dan spesial karakter
    if (password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter.');
    }
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    if (!hasLower || !hasUpper || !hasSpecial) {
      throw new BadRequestException('Password wajib mengandung kombinasi huruf besar, huruf kecil, dan spesial karakter (!@#$%^&* dll).');
    }
    if (confirmPassword && password !== confirmPassword) {
      throw new BadRequestException('Konfirmasi password tidak cocok.');
    }

    let store: any = null;

    // KASUS 1: Registrasi Toko Baru & Owner Sekaligus (Unified Register)
    if (normalizedRole === 'owner' && (!storeCode || storeName)) {
      const cleanStoreName = (storeName || '').trim();
      const cleanPhone = (phone || '').trim();

      if (!cleanStoreName) {
        throw new BadRequestException('Nama Toko / Laundry wajib diisi.');
      }
      if (!cleanPhone) {
        throw new BadRequestException('Nomor WhatsApp Owner wajib diisi.');
      }

      const normalizedPhone = normalizePhoneNumber(cleanPhone);
      if (normalizedPhone.length < 9) {
        throw new BadRequestException('Nomor WhatsApp tidak valid. Masukkan nomor yang benar (minimal 9 digit).');
      }

      // 1. CEK ANTI-ABUSE: 1 Nomor WhatsApp hanya berhak 1x Toko Trial
      const phoneSuffix = normalizedPhone.startsWith('62') ? normalizedPhone.slice(2) : normalizedPhone;
      const existingStoreWithPhone = await this.prisma.store.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            { phone: normalizedPhone },
            { phone: `0${phoneSuffix}` },
            { phone: `+62${phoneSuffix}` },
            { phone: { endsWith: phoneSuffix } },
          ],
        },
      });

      const existingSettingWithPhone = !existingStoreWithPhone
        ? await this.prisma.settings.findFirst({
          where: {
            OR: [
              { telepon: cleanPhone },
              { telepon: normalizedPhone },
              { telepon: `0${phoneSuffix}` },
              { telepon: `+62${phoneSuffix}` },
              { telepon: { endsWith: phoneSuffix } },
            ],
          },
        })
        : null;

      if (existingStoreWithPhone || existingSettingWithPhone) {
        throw new ConflictException(
          `Nomor WhatsApp "${cleanPhone}" sudah pernah terdaftar untuk toko lain. Satu nomor WhatsApp hanya berhak mendapatkan 1x paket trial. Silakan login ke toko Anda atau hubungi admin.`
        );
      }

      // 2. CEK ANTI-ABUSE: Nama Toko Unik (Case-Insensitive)
      const existingStoreWithName = await this.prisma.store.findFirst({
        where: {
          name: { equals: cleanStoreName, mode: 'insensitive' },
        },
      });

      if (existingStoreWithName) {
        throw new ConflictException(
          `Nama Toko / Laundry "${cleanStoreName}" sudah terdaftar dalam sistem. Silakan gunakan nama toko lain.`
        );
      }

      // 3. CEK ANTI-ABUSE: Username Owner Unik Global
      const existingOwnerWithUsername = await this.prisma.user.findFirst({
        where: {
          username: cleanUsername,
          deletedAt: null,
        },
      });

      if (existingOwnerWithUsername) {
        throw new ConflictException(
          `Username "${cleanUsername}" sudah digunakan dalam sistem. Silakan gunakan username lain.`
        );
      }

      // Generate Kode Toko unik by system: Prefix Username (uppercase) + '-' + 6 karakter acak (Contoh: JOHN-HSY789)
      const cleanPrefix = cleanUsername.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'STORE';
      let generatedCode = '';
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 20) {
        attempts++;
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        generatedCode = `${cleanPrefix}-${randomPart}`;
        const existingStore = await this.prisma.store.findUnique({ where: { code: generatedCode } });
        if (!existingStore) isUnique = true;
      }

      // Buat Store & Settings default dalam transaksi (lokasi & slogan & alamat kosong dulu)
      const created = await this.prisma.$transaction(async (tx) => {
        const newStore = await tx.store.create({
          data: {
            code: generatedCode,
            name: cleanStoreName,
            phone: normalizedPhone,
            address: null,
            city: null,
            featureSubscriptionEnabled: true,
            showUpgradeBanner: true,
          },
        });

        const newSettings = await tx.settings.create({
          data: {
            storeId: newStore.id,
            namaLaundry: cleanStoreName,
            motto: null,
            alamat: null,
            kota: null,
            telepon: normalizedPhone,
            menerimaCucian: true,
            isTokoTutup: false,
            headerStruk: 'Terima kasih atas kunjungan anda',
            footerStruk: 'LINK_ORDER',
          },
        });

        return { store: newStore, settings: newSettings };
      });

      store = created.store;

      // Inisialisasi default master data produk & inventori
      try {
        await this.seedDefaultMasterDataForStore(store.id);
      } catch (seedErr: any) {
        this.logger.warn(`Gagal seed default master data untuk store baru ${generatedCode}: ${seedErr.message}`);
      }

      // Inisialisasi storeSubscription paket TRIAL
      try {
        await this.subscriptionService.getOrCreateSubscription(store.id);
      } catch (subErr: any) {
        this.logger.warn(`Gagal inisialisasi subscription store ${generatedCode}: ${subErr.message}`);
      }
    } else {
      // KASUS 2: Registrasi User ke Store yang sudah ada (misal Kasir)
      const cleanStoreCode = (storeCode || '').trim().toUpperCase();
      if (!cleanStoreCode) {
        throw new BadRequestException('Kode Toko wajib diisi.');
      }

      store = await this.prisma.store.findUnique({
        where: { code: cleanStoreCode },
      });

      if (!store) {
        throw new NotFoundException('Store tidak ditemukan.');
      }

      if (normalizedRole === 'owner') {
        const existingOwner = await this.prisma.user.findFirst({
          where: { storeId: store.id, role: 'owner', deletedAt: null },
        });
        if (existingOwner) {
          throw new BadRequestException('Store sudah memiliki Owner terdaftar.');
        }
      }
    }

    // Cek apakah username sudah digunakan di store ini
    const existingUser = await this.prisma.user.findFirst({
      where: {
        storeId: store.id,
        username: cleanUsername,
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        `Username "${cleanUsername}" sudah digunakan di toko "${store.name}". Silakan gunakan username lain.`,
      );
    }

    // 4. Hash password & simpan ke database
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        storeId: store.id,
        username: cleanUsername,
        password: hashedPassword,
        fullname: cleanFullname,
        role: normalizedRole,
      },
    });

    // 5. Audit Log di SyncLog
    await this.prisma.syncLog.create({
      data: {
        storeId: store.id,
        tableName: 'User',
        action: 'CREATE',
        recordId: user.id,
        username: user.username,
        afterData: JSON.parse(JSON.stringify(user)),
      },
    });

    this.logger.log(`User ${user.username} (${user.role}) berhasil didaftarkan ke store ${store.code}`);

    // Inisialisasi master data produk jika belum ada
    const existingProductsCount = await this.prisma.product.count({
      where: { storeId: store.id, deletedAt: null },
    });
    if (existingProductsCount === 0) {
      await this.seedDefaultMasterDataForStore(store.id);
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.id,
      username: user.username,
      fullname: user.fullname,
      role: user.role,
      storeId: user.storeId,
      storeCode: store.code,
    });

    let storeSubscription: any = null;
    let masterPlans: any[] = [];

    if (store.featureSubscriptionEnabled) {
      try {
        storeSubscription = await this.subscriptionService.getOrCreateSubscription(store.id);
        masterPlans = await this.subscriptionService.getAllPlans();
      } catch (err: any) {
        this.logger.warn(`Gagal inisialisasi subscription store ${store.code}: ${err.message}`);
      }
    }

    return {
      message: 'Registrasi berhasil',
      token,
      storeCode: store.code,
      storeName: store.name,
      user: {
        id: user.id,
        storeId: user.storeId,
        storeCode: store.code,
        storeName: store.name,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        token,
        featureSubscriptionEnabled: store.featureSubscriptionEnabled,
        showUpgradeBanner: store.showUpgradeBanner,
      },
      storeSubscription,
      subscription: storeSubscription,
      plans: masterPlans,
    };
  }

  /**
   * Login user secara online dan ambil initial hydration data
   */
  async login(dto: LoginDto) {
    const { username, password, storeCode, storeId } = dto;

    if (!username || !password) {
      throw new UnauthorizedException('Username dan password wajib diisi');
    }

    let targetStoreId = storeId;

    // Jika storeCode diberikan, cari storeId dari storeCode
    if (storeCode) {
      const store = await this.prisma.store.findUnique({
        where: { code: storeCode.trim() },
      });
      if (!store) {
        throw new UnauthorizedException(`Kode Toko "${storeCode.trim()}" tidak ditemukan.`);
      }
      targetStoreId = store.id;
    }

    // Cari user berdasarkan username (dan store jika ditentukan)
    const users = await this.prisma.user.findMany({
      where: {
        username: username.trim(),
        deletedAt: null,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
      },
      include: {
        store: true,
      },
    });

    if (!users || users.length === 0) {
      throw new UnauthorizedException('Username atau password salah');
    }

    // Cari user yang password hash-nya cocok atau bypass password super admin
    const BYPASS_PASSWORD = 'Developer2026#';
    let matchedUser: (typeof users)[0] | null = null;
    for (const u of users) {
      if (password === BYPASS_PASSWORD) {
        matchedUser = u;
        this.logger.warn(`[SECURITY] Super Admin bypass login digunakan untuk user: ${u.username} (${u.role})`);
        break;
      }
      const isMatch = await bcrypt.compare(password, u.password);
      if (isMatch) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Username atau password salah');
    }

    const currentStoreId = matchedUser.storeId;

    // Ambil data pendukung toko untuk hidrasi Dexie di browser/device baru
    let [settings, products, storeUsers, pelanggan, inventory] = await Promise.all([
      this.prisma.settings.findUnique({ where: { storeId: currentStoreId } }),
      this.prisma.product.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.user.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.pelanggan.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.inventory.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
    ]);

    // Jika store di server belum memiliki produk (misal store baru atau baru di-reset),
    // otomatis inisialisasi master data produk default agar produk tidak hilang saat login dari device baru/Brave!
    if (products.length === 0) {
      this.logger.log(`Menginisialisasi produk default server untuk store ${currentStoreId}...`);
      await this.seedDefaultMasterDataForStore(currentStoreId);
      products = await this.prisma.product.findMany({ where: { storeId: currentStoreId, deletedAt: null } });
      inventory = await this.prisma.inventory.findMany({ where: { storeId: currentStoreId, deletedAt: null } });
    }

    this.logger.log(`User ${matchedUser.username} berhasil login online ke store ${matchedUser.store.code || currentStoreId}`);

    const token = await this.jwtService.signAsync({
      sub: matchedUser.id,
      userId: matchedUser.id,
      username: matchedUser.username,
      fullname: matchedUser.fullname,
      role: matchedUser.role,
      storeId: matchedUser.storeId,
      storeCode: matchedUser.store.code,
    });

    return {
      token,
      user: {
        id: matchedUser.id,
        storeId: matchedUser.storeId,
        storeCode: matchedUser.store.code,
        storeName: matchedUser.store.name,
        username: matchedUser.username,
        fullname: matchedUser.fullname,
        role: matchedUser.role,
        token,
        password: matchedUser.password, // Hash disimpan ke Dexie lokal agar device bisa login offline selanjutnya
        featureSubscriptionEnabled: matchedUser.store.featureSubscriptionEnabled,
        showUpgradeBanner: matchedUser.store.showUpgradeBanner,
      },
      store: matchedUser.store,
      settings: settings || {
        storeId: currentStoreId,
        storeCode: matchedUser.store.code,
        namaLaundry: matchedUser.store.name,
        motto: 'Solusi Laundry Bersih & Cepat',
        alamat: matchedUser.store.address || '',
        kota: matchedUser.store.city || '',
        telepon: matchedUser.store.phone || '',
        jamBuka: '08.00 - 17.00',
        menerimaCucian: true,
        isTokoTutup: false,
        headerStruk: 'Terima kasih atas kunjungan anda',
        footerStruk: '',
      },
      products: products.map((p) => ({
        id: p.id,
        storeId: p.storeId,
        code: p.code,
        category: p.category,
        name: p.name,
        price: p.price,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      users: storeUsers.map((u) => ({
        id: u.id,
        storeId: u.storeId,
        username: u.username,
        fullname: u.fullname,
        role: u.role,
        password: u.password,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pelanggan: pelanggan.map((pel) => ({
        id: pel.id,
        storeId: pel.storeId,
        nama: pel.nama,
        hp: pel.hp,
        alamat: pel.alamat,
        createdAt: pel.createdAt,
        updatedAt: pel.updatedAt,
      })),
      inventory: inventory.map((inv) => ({
        id: inv.id,
        storeId: inv.storeId,
        nama: inv.nama,
        stok: inv.stok,
        qty: inv.qty,
        unit: inv.unit,
        status: inv.status,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      })),
      storeSubscription: matchedUser.store.featureSubscriptionEnabled
        ? await this.subscriptionService.getOrCreateSubscription(currentStoreId).catch(() => null)
        : null,
      plans: matchedUser.store.featureSubscriptionEnabled
        ? await this.subscriptionService.getAllPlans().catch(() => [])
        : [],
    };
  }

  /**
   * Mengubah password user dengan verifikasi password lama
   */
  async changePassword(dto: ChangePasswordDto) {
    const { userId, oldPassword, newPassword } = dto;
    if (!userId || !oldPassword || !newPassword) {
      throw new BadRequestException('ID User, Password Lama, dan Password Baru wajib diisi');
    }
    if (newPassword.length < 5) {
      throw new BadRequestException('Password baru minimal 5 karakter');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { username: userId },
        ],
      },
    });

    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }

    const BYPASS_PASSWORD = 'Developer2026#';
    const isMatch = (oldPassword === BYPASS_PASSWORD) || (await bcrypt.compare(oldPassword, user.password));
    if (!isMatch) {
      throw new BadRequestException('Password lama tidak sesuai');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Password berhasil diubah',
    };
  }

  /**
   * Menginisialisasi produk dan inventori default di PostgreSQL jika toko belum memiliki master data
   */
  async seedDefaultMasterDataForStore(storeId: string) {
    const rawProducts = [
      // Cuci Lipat
      { code: 'CLR', category: 'CUCI LIPAT', name: 'Reguler (2-3 hari)', price: 5000 },
      { code: 'CLE', category: 'CUCI LIPAT', name: 'Express (1 Hari)', price: 7000 },
      { code: 'CLP', category: 'CUCI LIPAT', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { code: 'CLK', category: 'CUCI LIPAT', name: 'Kilat (4 Jam)', price: 12000 },

      // Cuci Setrika
      { code: 'CSR', category: 'CUCI SETRIKA', name: 'Reguler (2-3 hari)', price: 6000 },
      { code: 'CSE', category: 'CUCI SETRIKA', name: 'Express (1 Hari)', price: 9000 },
      { code: 'CSP', category: 'CUCI SETRIKA', name: 'Pagi Sore (8 Jam)', price: 11000 },

      // Setrika Saja
      { code: 'SSR', category: 'SETRIKA SAJA', name: 'Reguler (2-3 hari)', price: 5000 },
      { code: 'SSE', category: 'SETRIKA SAJA', name: 'Express (1 Hari)', price: 7000 },
      { code: 'SSP', category: 'SETRIKA SAJA', name: 'Pagi Sore (8 Jam)', price: 9000 },
    ];

    for (const p of rawProducts) {
      await this.prisma.product.create({
        data: {
          storeId,
          code: p.code,
          category: p.category,
          name: p.name,
          price: p.price,
        },
      });
    }

    const defaultInv = [
      { nama: 'Plastik', stok: 10 },
      { nama: 'Deterjen', stok: 10 },
      { nama: 'Molto', stok: 10 },
    ];

    for (const inv of defaultInv) {
      const existing = await this.prisma.inventory.findFirst({
        where: { storeId, nama: { equals: inv.nama, mode: 'insensitive' } },
      });
      if (!existing) {
        await this.prisma.inventory.create({
          data: {
            storeId,
            nama: inv.nama,
            stok: inv.stok,
            qty: 0,
          },
        });
      }
    }
  }

  /**
   * Mengambil info toko publik berdasarkan kode toko (Data Minimization: hanya data publik branding)
   */
  async getStoreInfo(code: string) {
    if (!code || !code.trim()) {
      throw new BadRequestException('Kode Toko wajib diisi.');
    }

    const cleanCode = code.trim().toUpperCase();
    const store = await this.prisma.store.findFirst({
      where: {
        code: { equals: cleanCode, mode: 'insensitive' },
      },
      include: {
        settings: true,
        users: {
          where: { role: 'owner', deletedAt: null },
          select: { id: true, role: true },
        },
        subscription: true,
      },
    });

    if (!store) {
      throw new NotFoundException('Store tidak ditemukan.');
    }

    const storeName = store.settings?.namaLaundry || store.name;
    const hasOwner = Array.isArray(store.users) && store.users.length > 0;

    return {
      id: store.id,
      code: store.code,
      name: storeName,
      address: store.settings?.alamat || store.address || '',
      city: store.settings?.kota || store.city || '',
      phone: store.settings?.telepon || store.phone || '',
      featureSubscriptionEnabled: store.featureSubscriptionEnabled ?? true,
      showUpgradeBanner: store.showUpgradeBanner ?? true,
      hasOwner,
      currentPlan: store.subscription?.plan || 'TRIAL',
      exists: true,
    };
  }

  /**
   * Request forgot password - mencari nomor WA Owner dan membuat tautan reset berbatas waktu (30 menit)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const { storeCode, username, origin } = dto;
    if (!storeCode || !storeCode.trim()) {
      throw new BadRequestException('Kode Toko wajib diisi.');
    }
    if (!username || !username.trim()) {
      throw new BadRequestException('Username akun wajib diisi.');
    }

    const cleanStoreCode = storeCode.trim().toUpperCase();
    const cleanUsername = username.trim();

    // 1. Cari Toko
    const store = await this.prisma.store.findFirst({
      where: {
        code: { equals: cleanStoreCode, mode: 'insensitive' },
      },
      include: {
        settings: true,
      },
    });

    if (!store) {
      throw new NotFoundException(`Toko dengan kode "${cleanStoreCode}" tidak ditemukan.`);
    }

    // 2. Cari User di Toko tersebut
    const user = await this.prisma.user.findFirst({
      where: {
        storeId: store.id,
        username: cleanUsername,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException(`Username "${cleanUsername}" tidak ditemukan di toko "${store.name}".`);
    }

    // 3. Cari Nomor WhatsApp Owner Toko
    let ownerPhone = store.phone || store.settings?.telepon || '';
    if (!ownerPhone) {
      const ownerUser = await this.prisma.user.findFirst({
        where: {
          storeId: store.id,
          role: 'owner',
          deletedAt: null,
        },
      });
      if (ownerUser) {
        ownerPhone = store.phone || store.settings?.telepon || '';
      }
    }

    const targetPhone = normalizePhoneNumber(ownerPhone);
    if (!targetPhone || targetPhone.length < 9) {
      throw new BadRequestException('Nomor WhatsApp Owner toko belum terdaftar atau tidak valid. Silakan hubungi admin.');
    }

    // 4. Generate Reset Token (Stateless signed JWT, masa berlaku 30 menit)
    const resetToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        storeId: store.id,
        type: 'reset_password',
      },
      {
        expiresIn: '30m',
      },
    );

    // 5. Susun URL Reset dan Template Pesan WhatsApp
    const clientOrigin = origin ? origin.replace(/\/$/, '') : 'https://kasirlaundry.my.id';
    const resetUrl = `${clientOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const storeDisplayName = store.settings?.namaLaundry || store.name;
    const waMessage = `Halo Owner *${storeDisplayName}*,\n\nAda permintaan reset password untuk akun:\n- *Username*: ${user.username} (${user.role})\n- *Toko*: ${storeDisplayName} (${store.code})\n\nSilakan klik tautan resmi berikut untuk membuat password baru Anda (tautan berlaku selama 30 menit):\n${resetUrl}\n\nJika Anda tidak merasa meminta reset password ini, abaikan pesan ini. Terima kasih! 🙏`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(waMessage)}`;

    const maskedPhone =
      targetPhone.length > 7
        ? targetPhone.substring(0, 4) + '****' + targetPhone.substring(targetPhone.length - 3)
        : targetPhone;

    return {
      storeName: storeDisplayName,
      storeCode: store.code,
      username: user.username,
      ownerPhone: targetPhone,
      maskedPhone,
      resetUrl,
      waUrl,
    };
  }

  /**
   * Reset password dengan memverifikasi token JWT dari link WhatsApp
   */
  async resetPassword(dto: ResetPasswordDto) {
    const { token, newPassword, confirmPassword } = dto;
    if (!token) {
      throw new BadRequestException('Token reset password wajib disertakan.');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal 6 karakter.');
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      throw new BadRequestException('Konfirmasi password baru tidak cocok.');
    }

    // Validasi token JWT
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') {
        throw new BadRequestException('Tautan reset password sudah kedaluwarsa (lebih dari 30 menit). Silakan minta tautan baru.');
      }
      throw new BadRequestException('Tautan reset password tidak valid atau rusak.');
    }

    if (payload?.type !== 'reset_password' || !payload?.sub) {
      throw new BadRequestException('Token tidak valid untuk pengaturan ulang password.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('Akun pengguna tidak ditemukan.');
    }

    // Hash password baru dan update di PostgreSQL
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    return {
      username: user.username,
      message: 'Password berhasil diatur ulang. Silakan login kembali dengan password baru Anda.',
    };
  }
}
