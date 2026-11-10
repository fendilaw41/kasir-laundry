import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StorageDriver, StoredFileResult } from './storage-driver.interface';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as path from 'path';

@Injectable()
export class S3MinioStorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3MinioStorageDriver.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    this.bucketName = process.env.R2_BUCKET || process.env.S3_BUCKET || 'image';

    const endpoint = r2AccountId
      ? `https://${r2AccountId}.r2.cloudflarestorage.com`
      : process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
    const region = r2AccountId ? 'auto' : process.env.S3_REGION || 'us-east-1';
    const accessKeyId =
      process.env.R2_ACCESS_KEY || process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretAccessKey =
      process.env.R2_SECRET_KEY || process.env.S3_SECRET_KEY || 'minioadmin';
    const forcePathStyle = r2AccountId
      ? false
      : process.env.S3_FORCE_PATH_STYLE !== 'false';
    const useSsl = r2AccountId ? true : process.env.S3_USE_SSL === 'true';

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
      tls: useSsl,
    });

    this.logger.log(
      `Storage Driver diinisialisasi ke endpoint: ${endpoint}, bucket: ${this.bucketName}, folder: laundry/`,
    );
  }

  private sanitizeIdentifier(input: string): string {
    const sanitized = path.basename(input).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) {
      throw new BadRequestException(`Pengenal toko tidak valid: ${input}`);
    }
    return sanitized;
  }

  private sanitizeFilename(filename: string): string {
    const cleanFilename = path
      .basename(filename)
      .replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!cleanFilename) {
      throw new BadRequestException(`Nama berkas tidak valid: ${filename}`);
    }
    return cleanFilename;
  }

  async saveFile(
    storeId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFileResult> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    // Folder di bucket "image" adalah "laundry/"
    const key = `laundry/${safeStoreId}/${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);

    const relativeUrl = `/chat/files/${safeStoreId}/${safeFilename}`;
    this.logger.log(
      `Berkas berhasil diunggah ke Storage (R2/S3): ${key} (${buffer.length} bytes)`,
    );

    return {
      fileKey: key,
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
    const key = `laundry/${safeStoreId}/${safeFilename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new NotFoundException(`Isi berkas Storage kosong: ${key}`);
      }

      return {
        stream: response.Body as Readable,
        mimeType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error: any) {
      // Fallback untuk legacy key (chat/...) jika ada
      if (
        error.name === 'NoSuchKey' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        try {
          const legacyKey = `chat/${safeStoreId}/${safeFilename}`;
          const legacyCommand = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: legacyKey,
          });
          const legacyResponse = await this.s3Client.send(legacyCommand);
          if (legacyResponse.Body) {
            return {
              stream: legacyResponse.Body as Readable,
              mimeType: legacyResponse.ContentType,
              contentLength: legacyResponse.ContentLength,
            };
          }
        } catch (_) {}
        throw new NotFoundException(
          `Berkas foto tidak ditemukan di Storage: ${key}`,
        );
      }
      this.logger.error(`Error mengambil berkas dari Storage (${key}):`, error);
      throw error;
    }
  }

  async getPresignedUrl(
    storeId: string,
    filename: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    const key = `laundry/${safeStoreId}/${safeFilename}`;

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async deleteFile(storeId: string, filename: string): Promise<boolean> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    const key = `laundry/${safeStoreId}/${safeFilename}`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error(`Gagal menghapus berkas di Storage (${key}):`, error);
      return false;
    }
  }
}
