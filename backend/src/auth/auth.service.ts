import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Login user secara online dan ambil initial hydration data (Store, Settings, Products, Users, Pelanggan, Inventory)
   */
  async login(dto: LoginDto) {
    const { username, password, storeId } = dto;

    if (!username || !password) {
      throw new UnauthorizedException('Username dan password wajib diisi');
    }

    // Cari user berdasarkan username
    const users = await this.prisma.user.findMany({
      where: {
        username,
        deletedAt: null,
        ...(storeId ? { storeId } : {}),
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

    this.logger.log(`User ${matchedUser.username} berhasil login online ke store ${currentStoreId}`);

    return {
      user: {
        id: matchedUser.id,
        storeId: matchedUser.storeId,
        username: matchedUser.username,
        fullname: matchedUser.fullname,
        role: matchedUser.role,
        password: matchedUser.password, // Hash disimpan ke Dexie lokal agar device bisa login offline selanjutnya
      },
      store: matchedUser.store,
      settings: settings || {
        storeId: currentStoreId,
        namaLaundry: matchedUser.store.name,
        alamat: matchedUser.store.address || '',
        kota: matchedUser.store.city || '',
        telepon: matchedUser.store.phone || '',
        jamBuka: '08.00 - 17.00',
        menerimaCucian: true,
        headerStruk: 'Terima kasih atas kunjungan anda',
        footerStruk: 'kasirlaundry.my.id',
      },
      products: products.map(p => ({
        id: p.id,
        storeId: p.storeId,
        code: p.code,
        category: p.category,
        name: p.name,
        price: p.price,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      users: storeUsers.map(u => ({
        id: u.id,
        storeId: u.storeId,
        username: u.username,
        fullname: u.fullname,
        role: u.role,
        password: u.password,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      pelanggan: pelanggan.map(pel => ({
        id: pel.id,
        storeId: pel.storeId,
        nama: pel.nama,
        hp: pel.hp,
        alamat: pel.alamat,
        createdAt: pel.createdAt,
        updatedAt: pel.updatedAt,
      })),
      inventory: inventory.map(inv => ({
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
