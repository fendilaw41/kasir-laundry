import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: any;
  let reflector: Reflector;

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };
    reflector = new Reflector();
    guard = new JwtAuthGuard(mockJwtService, reflector);
  });

  const createMockContext = (headers: Record<string, string> = {}, isPublic = false): ExecutionContext => {
    const request = {
      headers,
    };
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('should allow access to public routes without token', async () => {
    const context = createMockContext({}, true);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException when no Authorization header is provided', async () => {
    const context = createMockContext({}, false);
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Akses ditolak: Bearer token tidak ditemukan di header Authorization.'),
    );
  });

  it('should throw UnauthorizedException when Bearer prefix is missing', async () => {
    const context = createMockContext({ authorization: 'Basic 12345' }, false);
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Akses ditolak: Bearer token tidak ditemukan di header Authorization.'),
    );
  });

  it('should throw UnauthorizedException when token is invalid', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
    const context = createMockContext({ authorization: 'Bearer invalid.token.here' }, false);
    await expect(guard.canActivate(context)).rejects.toThrow(
      new UnauthorizedException('Akses ditolak: Bearer token tidak valid atau telah kedaluwarsa.'),
    );
  });

  it('should allow access and attach payload to request when token is valid', async () => {
    const payload = { userId: '123', username: 'kasir1', role: 'kasir', storeId: 'store-1' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const request: any = { headers: { authorization: 'Bearer valid.jwt.token' } };
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const context: any = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(request.user).toEqual(payload);
  });
});
