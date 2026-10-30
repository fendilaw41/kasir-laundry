import { Injectable, Logger } from '@nestjs/common';
import { StorageDriver, StoredFileResult } from './storage-driver.interface';
import { LocalStorageDriver } from './local-storage.driver';
import { S3MinioStorageDriver } from './s3-minio-storage.driver';
import { Readable } from 'stream';

export type StorageDriverType = 'local' | 's3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly localDriver: LocalStorageDriver,
    private readonly s3Driver: S3MinioStorageDriver,
  ) {}

  public getActiveDriverType(customDriverOverride?: string | null): StorageDriverType {
    if (customDriverOverride === 's3' || customDriverOverride === 'local') {
      return customDriverOverride;
    }
    const envDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
    return envDriver === 's3' || envDriver === 'minio' ? 's3' : 'local';
  }

  public getDriver(customDriverOverride?: string | null): StorageDriver {
    const driverType = this.getActiveDriverType(customDriverOverride);
    if (driverType === 's3') {
      return this.s3Driver;
    }
    return this.localDriver;
  }

  async saveFile(
    storeId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
    customDriverOverride?: string | null,
  ): Promise<StoredFileResult> {
    const driver = this.getDriver(customDriverOverride);
    return driver.saveFile(storeId, filename, buffer, mimeType);
  }

  async getFileStream(
    storeId: string,
    filename: string,
    customDriverOverride?: string | null,
  ): Promise<{ stream: Readable; mimeType?: string; contentLength?: number }> {
    const driver = this.getDriver(customDriverOverride);
    return driver.getFileStream(storeId, filename);
  }

  async deleteFile(
    storeId: string,
    filename: string,
    customDriverOverride?: string | null,
  ): Promise<boolean> {
    const driver = this.getDriver(customDriverOverride);
    return driver.deleteFile(storeId, filename);
  }
}

