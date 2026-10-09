import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login User Online & Pull Data Toko',
    description: 'Memvalidasi kredensial pengguna dan mengembalikan data user, store, settings, dan master data untuk sinkronisasi ke IndexedDB lokal client.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login berhasil dan data hidrasi dikembalikan.' })
  @ApiResponse({ status: 401, description: 'Username atau password salah.' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Login berhasil',
      data: result,
    };
  }
}
