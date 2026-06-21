import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthUser, JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/register.dto';
import { renderExtensionAuthPage } from './extension-auth.page';
import { resolveWebIndexPath } from '../spa/web-dist';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  extensionAuthPage(
    @Query('source') source: string | undefined,
    @Query('mode') mode: string | undefined,
    @Res() res: Response,
  ) {
    if (source !== 'extension') {
      const indexPath = resolveWebIndexPath();
      if (indexPath) {
        res.sendFile(indexPath);
        return;
      }

      res.status(503).json({
        message:
          'Web dashboard is not built yet. Run "npm run build:web" and restart the API.',
        statusCode: 503,
      });
      return;
    }

    const authMode = mode === 'signup' ? 'signup' : 'signin';
    res.send(renderExtensionAuthPage(authMode));
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.authService.getUserById(user.uid);
    return { user: profile };
  }
}
