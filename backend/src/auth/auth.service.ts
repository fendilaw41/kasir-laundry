import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Registrasi user baru (Owner atau Kasir)
   * ATURAN: Hanya boleh 1 Owner untuk 1 Store!
   */
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

    return {
      message: 'Registrasi berhasil',
      user: {
        id: user.id,
        storeId: user.storeId,
        storeCode: store.code,
        storeName: store.name,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
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

    // Cari user yang password hash-nya cocok
    let matchedUser: (typeof users)[0] | null = null;
    for (const u of users) {
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
    const [settings, products, storeUsers, pelanggan, inventory] = await Promise.all([
      this.prisma.settings.findUnique({ where: { storeId: currentStoreId } }),
      this.prisma.product.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.user.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.pelanggan.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
      this.prisma.inventory.findMany({ where: { storeId: currentStoreId, deletedAt: null } }),
    ]);

    this.logger.log(`User ${matchedUser.username} berhasil login online ke store ${matchedUser.store.code || currentStoreId}`);

    return {
      user: {
        id: matchedUser.id,
        storeId: matchedUser.storeId,
        storeCode: matchedUser.store.code,
        storeName: matchedUser.store.name,
        username: matchedUser.username,
        fullname: matchedUser.fullname,
        role: matchedUser.role,
        password: matchedUser.password, // Hash disimpan ke Dexie lokal agar device bisa login offline selanjutnya
      },
      store: matchedUser.store,
      settings: settings || {
        storeId: currentStoreId,
        storeCode: matchedUser.store.code,
        namaLaundry: matchedUser.store.name,
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
}
