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
import { SubscriptionService } from '../subscription/subscription.service';
import * as bcrypt from 'bcryptjs';

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
    const { code, name, address, city, phone, password } = dto;

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

    // Cek apakah Kode Toko sudah terdaftar
    const existing = await this.prisma.store.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(`Kode Toko "${cleanCode}" sudah terdaftar.`);
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
          headerStruk: 'Terima kasih atas kunjungan anda',
          footerStruk: 'LINK_ORDER',
        },
      });

      return { store, settings };
    });

    return {
      message: `Store ${cleanName} (${cleanCode}) berhasil didaftarkan.`,
      store: result.store,
      settings: result.settings,
    };
  }

  async register(dto: RegisterDto) {
    const { storeCode, fullname, username, password, role = 'owner' } = dto;

    if (!storeCode || !fullname || !username || !password) {
      throw new BadRequestException('Kode Toko, Nama Lengkap, Username, dan Password wajib diisi.');
    }

    const cleanStoreCode = storeCode.trim();
    const cleanUsername = username.trim();
    const cleanFullname = fullname.trim();
    const normalizedRole = role.toLowerCase().trim();

    // 1. Validasi keberadaan Store berdasarkan storeCode
    const store = await this.prisma.store.findUnique({
      where: { code: cleanStoreCode },
    });

    if (!store) {
      throw new NotFoundException('Store tidak ditemukan.');
    }

    // 2. ATURAN: Batasi role owner HANYA boleh 1 owner per store
    if (normalizedRole === 'owner') {
      const existingOwner = await this.prisma.user.findFirst({
        where: {
          storeId: store.id,
          role: 'owner',
          deletedAt: null,
        },
      });

      if (existingOwner) {
        throw new BadRequestException('Store tidak ditemukan.');
      }
    }

    // 3. Cek apakah username sudah digunakan di store ini
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

    // 6. Inisialisasi Master Data Produk & Inventory Default langsung saat Register
    // Agar saat user login di device baru tidak lagi lambat melakukan seeding on-the-fly!
    const existingProductsCount = await this.prisma.product.count({
      where: { storeId: store.id, deletedAt: null },
    });
    if (existingProductsCount === 0) {
      this.logger.log(`[Register] Otomatis menginisialisasi produk & inventory default untuk store ${store.code}...`);
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

    return {
      message: 'Registrasi berhasil',
      token,
      user: {
        id: user.id,
        storeId: user.storeId,
        storeCode: store.code,
        storeName: store.name,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        token,
      },
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
        headerStruk: 'Terima kasih atas kunjungan anda',
        footerStruk: 'kasirlaundry.my.id',
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
      { code: 'CSK', category: 'CUCI SETRIKA', name: 'Kilat (4 Jam)', price: 14000 },

      // Setrika Saja
      { code: 'SSR', category: 'SETRIKA SAJA', name: 'Reguler (2-3 hari)', price: 5000 },
      { code: 'SSE', category: 'SETRIKA SAJA', name: 'Express (1 Hari)', price: 7000 },
      { code: 'SSP', category: 'SETRIKA SAJA', name: 'Pagi Sore (8 Jam)', price: 9000 },
      { code: 'SSK', category: 'SETRIKA SAJA', name: 'Kilat (4 Jam)', price: 12000 },
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
   * Mengambil info toko publik berdasarkan kode toko (untuk register dan PWA personalisasi)
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
      },
    });

    if (!store) {
      throw new NotFoundException('Store tidak ditemukan.');
    }

    const storeName = store.settings?.namaLaundry || store.name;

    return {
      code: store.code,
      name: storeName,
      address: store.settings?.alamat || store.address || '',
      city: store.settings?.kota || store.city || '',
      phone: store.settings?.telepon || store.phone || '',
    };
  }
}
