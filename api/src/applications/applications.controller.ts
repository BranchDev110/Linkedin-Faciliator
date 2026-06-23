import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.types';
import { ApprovedGuard } from '../auth/approved.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, MarkApplicationsAppliedDto, UpdateApplicationDto } from './dto/application.dto';
import { ExtractApplicationSkillsDto } from './dto/extract-skills.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard, ApprovedGuard)
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.applicationsService.findAllByUser(user.uid);
  }

  @Post('extract-skills')
  async extractSkills(
    @CurrentUser() user: AuthUser,
    @Body() dto: ExtractApplicationSkillsDto,
  ) {
    return this.applicationsService.extractSkills(user.uid, dto);
  }

  @Get('skills')
  async getJobSkills(@Query('linkedInJobId') linkedInJobId: string) {
    if (!linkedInJobId?.trim()) {
      return null;
    }

    return this.applicationsService.findJobSkills(linkedInJobId);
  }

  @Get('lookup')
  async lookup(
    @CurrentUser() user: AuthUser,
    @Query('linkedInJobId') linkedInJobId: string,
    @Query('jobId') jobId: string,
    @Query('profileId') profileId: string,
  ) {
    if (!jobId?.trim() && !linkedInJobId?.trim()) {
      return { found: false, application: null };
    }

    const application = await this.applicationsService.findByJobAndProfile(
      user.uid,
      profileId,
      {
        jobId,
        linkedInJobId,
      },
    );

    if (!application) {
      return { found: false, application: null };
    }

    return { found: true, application };
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applicationsService.findOne(user.uid, id);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.uid, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.applicationsService.update(user.uid, id, dto);
  }

  @Patch('bulk/applied')
  async markBulkApplied(
    @CurrentUser() user: AuthUser,
    @Body() dto: MarkApplicationsAppliedDto,
  ) {
    return this.applicationsService.markAppliedBulk(user.uid, dto.ids || []);
  }

  @Patch(':id/applied')
  async markApplied(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.applicationsService.markApplied(user.uid, id);
  }
}
