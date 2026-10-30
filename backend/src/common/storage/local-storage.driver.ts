import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageDriver, StoredFileResult } from './storage-driver.interface';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(process.cwd(), 'uploads', 'chat');
    this.ensureBaseDirectoryExists();
  }

  private ensureBaseDirectoryExists(): void {
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  private sanitizeIdentifier(input: string): string {
    const sanitized = path.basename(input).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) {
      throw new BadRequestException(`Pengenal toko tidak valid: ${input}`);
    }
    return sanitized;
  }

  private sanitizeFilename(filename: string): string {
    const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!cleanFilename) {
      throw new BadRequestException(`Nama berkas tidak valid: ${filename}`);
    }
    return cleanFilename;
  }

  private resolveStoreDirectory(storeId: string): string {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const storeDir = path.join(this.baseUploadDir, safeStoreId);
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    return storeDir;
  }

  async saveFile(
    storeId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFileResult> {
    const safeFilename = this.sanitizeFilename(filename);
    const storeDir = this.resolveStoreDirectory(storeId);
    const targetPath = path.join(storeDir, safeFilename);

    await fs.promises.writeFile(targetPath, buffer);

    const safeStoreId = this.sanitizeIdentifier(storeId);
    const relativeUrl = `/chat/files/${safeStoreId}/${safeFilename}`;

    this.logger.log(`Berkas lokal berhasil disimpan: ${targetPath} (${buffer.length} bytes)`);

    return {
      fileKey: `${safeStoreId}/${safeFilename}`,
      filePathOrUrl: relativeUrl,
      fileSize: buffer.length,
      mimeType,
    };
  }

  async getFileStream(
    storeId: string,
    filename: string,
  ): Promise<{ stream: Readable; mimeType?: string; contentLength?: number }> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    const filePath = path.join(this.baseUploadDir, safeStoreId, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`Berkas foto tidak ditemukan: ${safeStoreId}/${safeFilename}`);
    }

    const stat = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      contentLength: stat.size,
    };
  }

  async deleteFile(storeId: string, filename: string): Promise<boolean> {
    try {
      const safeStoreId = this.sanitizeIdentifier(storeId);
      const safeFilename = this.sanitizeFilename(filename);
      const filePath = path.join(this.baseUploadDir, safeStoreId, safeFilename);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Gagal menghapus berkas lokal ${filename}:`, error);
      return false;
    }
  }
}

