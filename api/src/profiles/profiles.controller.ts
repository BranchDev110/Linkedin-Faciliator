import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto';
import { UploadResumeTemplateDto } from './dto/upload-resume-template.dto';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.profilesService.findAllByUser(user.uid);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.profilesService.findOne(user.uid, id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profilesService.create(user.uid, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.update(user.uid, id, dto);
  }

  @Post(':id/resume-template')
  async uploadResumeTemplate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UploadResumeTemplateDto,
  ) {
    return this.profilesService.uploadResumeTemplate(user.uid, id, {
      format: dto.format,
      template: dto.template,
      templateDocxBase64: dto.templateDocxBase64,
      fileName: dto.fileName,
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.profilesService.remove(user.uid, id);
  }
}
