import 'dotenv/config';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is missing in .env!');
    }
    const pool = new Pool({
      connectionString,
      options: '-c timezone=UTC',
    });

    // Cegah crash Node.js jika koneksi idle PostgreSQL terputus
    pool.on('error', (err) => {
      this.logger.error(`PostgreSQL pool client error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma connected to database successfully.');
    } catch (error: any) {
      this.logger.error(
        `Prisma database connection error: ${error.message}. Server tetap aktif, namun request ke DB akan mengembalikan status 500 sampai PostgreSQL kembali berjalan.`,
      );
    }
  }

  /**
   * Cek status koneksi database secara aman tanpa melempar exception
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
