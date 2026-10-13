import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrasi Pengguna Baru (Owner / Kasir)',
    description: 'Mendaftarkan pengguna ke dalam toko berdasarkan Store Code. Role Owner dibatasi hanya 1 per Store.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Registrasi berhasil.' })
  @ApiResponse({ status: 400, description: 'Validasi gagal / Store sudah memiliki Owner.' })
  @ApiResponse({ status: 404, description: 'Kode Toko tidak ditemukan.' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      success: true,
      message: result.message,
      data: result.user,
    };
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login User Online & Pull Data Toko',
    description: 'Memvalidasi kredensial pengguna dan mengembalikan data user, store, settings, dan master data untuk sinkronisasi ke IndexedDB lokal client.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login berhasil dan data hidrasi dikembalikan.' })
  @ApiResponse({ status: 401, description: 'Username atau password salah / Kode Toko tidak ditemukan.' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Login berhasil',
      data: result,
    };
  }
}
