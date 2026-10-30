import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { StorageDriver, StoredFileResult } from './storage-driver.interface';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as path from 'path';

@Injectable()
export class S3MinioStorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3MinioStorageDriver.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET || 'kasir-laundry-chat';
    const endpoint = process.env.S3_ENDPOINT || 'http://127.0.0.1:9000';
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY || 'minioadmin';
    const secretAccessKey = process.env.S3_SECRET_KEY || 'minioadmin';
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
    const useSsl = process.env.S3_USE_SSL === 'true';

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

    this.logger.log(`S3/MinIO Driver diinisialisasi ke endpoint: ${endpoint}, bucket: ${this.bucketName}`);
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

  async saveFile(
    storeId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFileResult> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    const key = `chat/${safeStoreId}/${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);

    const relativeUrl = `/chat/files/${safeStoreId}/${safeFilename}`;
    this.logger.log(`Berkas berhasil diunggah ke S3/MinIO: ${key} (${buffer.length} bytes)`);

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
    const key = `chat/${safeStoreId}/${safeFilename}`;

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      if (!response.Body) {
        throw new NotFoundException(`Isi berkas S3/MinIO kosong: ${key}`);
      }

      return {
        stream: response.Body as Readable,
        mimeType: response.ContentType,
        contentLength: response.ContentLength,
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`Berkas foto tidak ditemukan di S3/MinIO: ${key}`);
      }
      this.logger.error(`Error mengambil berkas dari S3/MinIO (${key}):`, error);
      throw error;
    }
  }

  async deleteFile(storeId: string, filename: string): Promise<boolean> {
    const safeStoreId = this.sanitizeIdentifier(storeId);
    const safeFilename = this.sanitizeFilename(filename);
    const key = `chat/${safeStoreId}/${safeFilename}`;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error(`Gagal menghapus berkas di S3/MinIO (${key}):`, error);
      return false;
    }
  }
}

