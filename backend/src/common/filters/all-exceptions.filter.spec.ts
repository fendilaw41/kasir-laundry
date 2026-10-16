import { HttpStatus, HttpException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { Prisma } from '@prisma/client';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      url: '/api/auth/login',
      originalUrl: '/api/auth/login',
      method: 'POST',
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle database connection refused (ECONNREFUSED) gracefully with 500 status', () => {
    const dbError = new Prisma.PrismaClientKnownRequestError(
      'Invalid `this.prisma.store.findUnique()` invocation',
      {
        code: 'ECONNREFUSED',
        clientVersion: '7.9.1',
      },
    );

    filter.catch(dbError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'DatabaseConnectionError',
        message: expect.stringContaining('Tidak dapat terhubung ke database'),
        path: '/api/auth/login',
      }),
    );
  });

  it('should handle Prisma P2002 unique constraint error with 400 status', () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.9.1',
      meta: { target: ['username'] },
    });

    filter.catch(duplicateError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        error: 'DuplicateRecordError',
        message: expect.stringContaining('username'),
      }),
    );
  });

  it('should handle Prisma P2025 record not found error with 404 status', () => {
    const notFoundError = new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
      code: 'P2025',
      clientVersion: '7.9.1',
    });

    filter.catch(notFoundError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 404,
        error: 'RecordNotFoundError',
      }),
    );
  });

  it('should handle standard HttpExceptions (400, 401, 403) with correct status and message', () => {
    const badReq = new BadRequestException('Data input tidak lengkap');
    filter.catch(badReq, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 400,
        message: 'Data input tidak lengkap',
      }),
    );

    const unauthorized = new UnauthorizedException('Username atau password salah');
    filter.catch(unauthorized, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 401,
        message: 'Username atau password salah',
      }),
    );

    const forbidden = new ForbiddenException('Akses ditolak');
    filter.catch(forbidden, mockHost);
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 403,
        message: 'Akses ditolak',
      }),
    );
  });

  it('should handle generic unhandled Error with 500 status without crashing', () => {
    const unknownError = new Error('Unexpected runtime exception');

    filter.catch(unknownError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        error: 'Error',
      }),
    );
  });
});
