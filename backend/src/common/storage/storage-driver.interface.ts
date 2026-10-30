import { Readable } from 'stream';

export interface StoredFileResult {
  fileKey: string;
  filePathOrUrl: string;
  fileSize: number;
  mimeType: string;
}

export interface StorageDriver {
  saveFile(
    storeId: string,
    filename: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFileResult>;

  getFileStream(
    storeId: string,
    filename: string,
  ): Promise<{ stream: Readable; mimeType?: string; contentLength?: number }>;

  deleteFile(storeId: string, filename: string): Promise<boolean>;
}

