import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AuthUser } from '../auth/auth-user.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum } from 'class-validator';
import { UserRole, UserStatus } from '../database/schemas/user.schema';
import { AdminService } from './admin.service';

class UpdateUserStatusDto {
  @IsEnum(['pending', 'approved', 'rejected'])
  status!: UserStatus;
}

class UpdateUserRoleDto {
  @IsEnum(['user', 'admin'])
  role!: UserRole;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id/status')
  async updateUserStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(admin, id, dto.status);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(admin, id, dto.role);
  }

  @Get('profiles')
  async listProfiles(@Query('userId') userId?: string) {
    return this.adminService.listProfiles(userId);
  }

  @Get('applications')
  async listApplications(
    @Query('userId') userId?: string,
    @Query('profileId') profileId?: string,
  ) {
    return this.adminService.listApplications(userId, profileId);
  }
}
