import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ApprovedGuard } from '../auth/approved.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard, ApprovedGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  async list() {
    return this.jobsService.findAll();
  }

  @Get('lookup')
  async lookup(@Query('linkedInJobId') linkedInJobId: string) {
    if (!linkedInJobId?.trim()) {
      return null;
    }

    const skills = await this.jobsService.findByLinkedInJobId(linkedInJobId);
    if (!skills) {
      return null;
    }

    return { skills, fromCache: true };
  }

  @Get(':linkedInJobId')
  async getOne(@Param('linkedInJobId') linkedInJobId: string) {
    return this.jobsService.findOneByLinkedInJobId(linkedInJobId);
  }
}

@Controller('admin/jobs')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminJobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  async list() {
    return this.jobsService.findAll();
  }
}
