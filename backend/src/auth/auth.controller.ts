import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './public.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Registrasi Pengguna Baru (Owner / Kasir) - Public',
    description: 'Mendaftarkan pengguna ke dalam toko berdasarkan Store Code. Role Owner dibatasi hanya 1 per Store. Mengembalikan data user dan token otentikasi.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Registrasi berhasil dan token Bearer dikembalikan.' })
  @ApiResponse({ status: 400, description: 'Validasi gagal / Store sudah memiliki Owner.' })
  @ApiResponse({ status: 404, description: 'Kode Toko tidak ditemukan.' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      message: result.message,
      data: {
        token: result.token,
        user: result.user,
      },
    };
  }

  @Public()
  @Get('store-info')
  @ApiOperation({
    summary: 'Cek Informasi Toko Berdasarkan Store Code - Public',
    description: 'Mengambil nama dan info toko berdasarkan Store Code untuk validasi registrasi dan personalisasi instalasi PWA.',
  })
  @ApiQuery({ name: 'code', required: true, example: 'STORE01', description: 'Kode Toko unik' })
  @ApiResponse({ status: 200, description: 'Info toko berhasil ditemukan.' })
  @ApiResponse({ status: 400, description: 'Kode Toko tidak valid.' })
  @ApiResponse({ status: 404, description: 'Toko tidak ditemukan.' })
  async getStoreInfo(@Query('code') code: string) {
    const store = await this.authService.getStoreInfo(code);
    return {
      success: true,
      data: store,
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Login User Online & Dapatkan Bearer Token - Public',
    description: 'Memvalidasi kredensial pengguna dan mengembalikan JWT Bearer token beserta data user, store, settings, dan master data untuk sinkronisasi ke client.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login berhasil, token Bearer dan data hidrasi toko dikembalikan.' })
  @ApiResponse({ status: 401, description: 'Username atau password salah / Kode Toko tidak ditemukan.' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Login berhasil',
      data: result,
    };
  }

  @Post('change-password')
  @ApiOperation({
    summary: 'Ubah Password Pengguna',
    description: 'Memverifikasi password lama dan mengubahnya menjadi password baru.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password berhasil diubah.' })
  @ApiResponse({ status: 400, description: 'Password lama tidak cocok atau format tidak valid.' })
  async changePassword(@Body() dto: ChangePasswordDto) {
    const result = await this.authService.changePassword(dto);
    return {
      success: true,
      message: result.message,
    };
  }
}

