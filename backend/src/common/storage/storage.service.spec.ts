import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './local-storage.driver';
import { S3MinioStorageDriver } from './s3-minio-storage.driver';

describe('StorageService', () => {
  let service: StorageService;
  let mockLocalDriver: Partial<LocalStorageDriver>;
  let mockS3Driver: Partial<S3MinioStorageDriver>;

  beforeEach(async () => {
    mockLocalDriver = {
      saveFile: jest.fn().mockResolvedValue({
        fileKey: 'store1/test.jpg',
        filePathOrUrl: '/chat/files/store1/test.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }),
      getFileStream: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    mockS3Driver = {
      saveFile: jest.fn().mockResolvedValue({
        fileKey: 'chat/store1/test.jpg',
        filePathOrUrl: '/chat/files/store1/test.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }),
      getFileStream: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: LocalStorageDriver, useValue: mockLocalDriver },
        { provide: S3MinioStorageDriver, useValue: mockS3Driver },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  describe('getActiveDriverType', () => {
    it('should return local by default when STORAGE_DRIVER is local', () => {
      process.env.STORAGE_DRIVER = 'local';
      expect(service.getActiveDriverType()).toBe('local');
    });

    it('should return s3 when STORAGE_DRIVER is set to s3 or minio', () => {
      process.env.STORAGE_DRIVER = 's3';
      expect(service.getActiveDriverType()).toBe('s3');

      process.env.STORAGE_DRIVER = 'minio';
      expect(service.getActiveDriverType()).toBe('s3');
    });

    it('should respect customDriverOverride parameter', () => {
      expect(service.getActiveDriverType('s3')).toBe('s3');
      expect(service.getActiveDriverType('local')).toBe('local');
    });
  });

  describe('saveFile', () => {
    it('should delegate to local driver when driver is local', async () => {
      const buffer = Buffer.from('test image content');
      const result = await service.saveFile('store1', 'test.jpg', buffer, 'image/jpeg', 'local');

      expect(mockLocalDriver.saveFile).toHaveBeenCalledWith('store1', 'test.jpg', buffer, 'image/jpeg');
      expect(mockS3Driver.saveFile).not.toHaveBeenCalled();
      expect(result.fileKey).toBe('store1/test.jpg');
    });

    it('should delegate to S3 driver when driver is s3', async () => {
      const buffer = Buffer.from('test image content');
      const result = await service.saveFile('store1', 'test.jpg', buffer, 'image/jpeg', 's3');

      expect(mockS3Driver.saveFile).toHaveBeenCalledWith('store1', 'test.jpg', buffer, 'image/jpeg');
      expect(result.fileKey).toBe('chat/store1/test.jpg');
    });
  });
});

