import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-storage.driver';
import { S3MinioStorageDriver } from './s3-minio-storage.driver';

@Global()
@Module({
  providers: [StorageService, LocalStorageDriver, S3MinioStorageDriver],
  exports: [StorageService, LocalStorageDriver, S3MinioStorageDriver],
})
export class StorageModule {}

