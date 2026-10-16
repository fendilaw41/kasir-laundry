import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorName = 'InternalServerError';
    let message: string | string[] = 'Terjadi kesalahan internal pada server.';

    // 1. Cek apakah ini error koneksi database (Prisma / pg adapter / network / socket)
    if (this.isDatabaseConnectionError(exception)) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = 'DatabaseConnectionError';
      message =
        'Tidak dapat terhubung ke database. Pastikan server database PostgreSQL sedang aktif dan konfigurasi koneksi sudah benar.';
    }
    // 2. Cek Prisma Known Request Error (Unique constraint, foreign key, record not found, dsb)
    else if (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      (exception as any)?.name === 'PrismaClientKnownRequestError'
    ) {
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      const handled = this.handlePrismaKnownRequestError(prismaError);
      status = handled.status;
      errorName = handled.errorName;
      message = handled.message;
    }
    // 3. Cek Prisma Validation Error
    else if (
      exception instanceof Prisma.PrismaClientValidationError ||
      (exception as any)?.name === 'PrismaClientValidationError'
    ) {
      status = HttpStatus.BAD_REQUEST;
      errorName = 'DatabaseValidationError';
      message = 'Format atau tipe data input tidak sesuai dengan skema database.';
    }
    // 4. Cek Prisma Initialization Error
    else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      (exception as any)?.name === 'PrismaClientInitializationError'
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = 'DatabaseInitializationError';
      message = 'Gagal menginisialisasi koneksi database.';
    }
    // 5. Cek Prisma Rust Panic Error atau Unknown Request Error
    else if (
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      (exception as any)?.name === 'PrismaClientRustPanicError' ||
      (exception as any)?.name === 'PrismaClientUnknownRequestError'
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = 'DatabaseInternalError';
      message = 'Terjadi kesalahan internal pada mesin pemrosesan database.';
    }
    // 6. Cek NestJS HttpException resmi (BadRequest, Unauthorized, Forbidden, NotFound, Conflict, dsb)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      errorName = exception.name;

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, any>;
        if (resObj.message) {
          message = resObj.message;
        }
        if (resObj.error) {
          errorName = resObj.error;
        }
      }
    }
    // 7. Error runtime JavaScript / Node.js lainnya
    else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorName = exception.name || 'InternalServerError';
      message =
        process.env.NODE_ENV === 'production'
          ? 'Terjadi kesalahan internal pada server.'
          : exception.message || 'Internal server error';
    }

    // Format standar response JSON
    const errorResponse = {
      success: false,
      statusCode: status,
      error: errorName,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    };

    // Logging rapi tanpa crash / unhandled exception dump
    const formattedMsg = Array.isArray(message) ? message.join(', ') : message;
    const logInfo = `[${status}] ${request.method} ${request.originalUrl || request.url} - ${errorName}: ${formattedMsg}`;

    if (status >= 500) {
      const stack = (exception as any)?.stack;
      this.logger.error(logInfo, stack);
    } else if (status >= 400) {
      this.logger.warn(logInfo);
    } else {
      this.logger.log(logInfo);
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Mendeteksi apakah exception merupakan kegagalan koneksi database
   */
  private isDatabaseConnectionError(exception: any): boolean {
    if (!exception) return false;

    const code = exception.code || exception.cause?.code;
    const connectionCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EHOSTUNREACH',
      'EPIPE',
      // Postgres error codes untuk koneksi bermasalah
      '08000',
      '08001',
      '08003',
      '08004',
      '08006',
      '08007',
      '08P01',
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
      // Prisma connection codes
      'P1000', // Authentication failed
      'P1001', // Can't reach database server
      'P1002', // Database server timed out
      'P1003', // Database does not exist
      'P1008', // Operations timed out
      'P1011', // TLS connection error
      'P1017', // Server closed connection
    ];

    if (code && connectionCodes.includes(code)) {
      return true;
    }

    const message = (
      (exception.message || '') +
      ' ' +
      (exception.cause?.message || '')
    ).toLowerCase();

    const connectionPhrases = [
      'econnrefused',
      'connect econnrefused',
      "can't reach database server",
      'connection refused',
      'connection terminated unexpectedly',
      'connection closed',
      'timed out fetching a new connection from the pool',
      'server has closed the connection',
    ];

    return connectionPhrases.some((phrase) => message.includes(phrase));
  }

  /**
   * Menangani Prisma Known Request Errors
   */
  private handlePrismaKnownRequestError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    errorName: string;
    message: string;
  } {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : (error.meta?.target as string) || 'kolom unik';
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'DuplicateRecordError',
          message: `Data dengan ${target} tersebut sudah terdaftar dalam sistem (duplikat).`,
        };
      }
      case 'P2025': {
        return {
          status: HttpStatus.NOT_FOUND,
          errorName: 'RecordNotFoundError',
          message: 'Data yang diminta atau akan diubah tidak ditemukan.',
        };
      }
      case 'P2003': {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'ForeignKeyViolationError',
          message: 'Operasi gagal: data referensi relasi tidak valid atau berelasi dengan data lain.',
        };
      }
      case 'P2014': {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'RelationViolationError',
          message: 'Perubahan data melanggar integritas relasi yang dibutuhkan.',
        };
      }
      case 'P2000': {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'ValueTooLongError',
          message: 'Panjang nilai yang dimasukkan melebihi batas kapasitas kolom database.',
        };
      }
      case 'P2011': {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'NullConstraintViolationError',
          message: 'Kolom wajib tidak boleh bernilai kosong (null).',
        };
      }
      case 'P2012': {
        return {
          status: HttpStatus.BAD_REQUEST,
          errorName: 'MissingRequiredValueError',
          message: 'Nilai data yang wajib belum lengkap.',
        };
      }
      default: {
        if (error.code?.startsWith('P2')) {
          return {
            status: HttpStatus.BAD_REQUEST,
            errorName: 'PrismaQueryError',
            message: `Permintaan database tidak valid (Kode: ${error.code}).`,
          };
        }
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          errorName: 'DatabaseError',
          message: `Terjadi kesalahan pada database (Kode: ${error.code}).`,
        };
      }
    }
  }
}
