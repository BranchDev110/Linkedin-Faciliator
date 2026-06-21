import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getUser(user.uid);
  }
}
