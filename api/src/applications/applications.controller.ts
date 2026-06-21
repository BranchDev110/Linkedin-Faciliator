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
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto, MarkApplicationsAppliedDto, UpdateApplicationDto } from './dto/application.dto';
import { ExtractApplicationSkillsDto } from './dto/extract-skills.dto';

@Controller('applications')
@UseGuards(JwtAuthGuard)
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
    return this.applicationsService.extractSkills(
      user.uid,
      dto.jobDescription,
      dto.companyName || '',
      dto.applicationId,
      dto.linkedInJobId,
    );
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
    @Query('profileId') profileId: string,
  ) {
    if (!linkedInJobId?.trim() || !profileId?.trim()) {
      return null;
    }

    return this.applicationsService.findByLinkedInJobAndProfile(
      user.uid,
      linkedInJobId,
      profileId,
    );
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
