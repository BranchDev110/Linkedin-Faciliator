import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ApprovedGuard } from '../auth/approved.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecordJobDto } from './dto/record-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard, ApprovedGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  async list() {
    return this.jobsService.findAllSummaries();
  }

  @Post('record')
  async record(@Body() dto: RecordJobDto) {
    return this.jobsService.recordMetadata(dto);
  }

  @Get('record/:id')
  async getByRecordId(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  @Get('lookup')
  async lookup(@Query('linkedInJobId') linkedInJobId: string) {
    if (!linkedInJobId?.trim()) {
      return null;
    }

    const result = await this.jobsService.lookupByLinkedInJobId(linkedInJobId);
    if (!result?.found) {
      return null;
    }

    if (result.hasSkills && result.skills) {
      return {
        ...result,
        fromCache: true,
      };
    }

    return result;
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
