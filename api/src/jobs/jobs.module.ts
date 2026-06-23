import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { JdSkillExtractionService } from '../applications/jd-skill-extraction.service';
import { AdminJobsController, JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [DatabaseModule],
  controllers: [JobsController, AdminJobsController],
  providers: [JobsService, JdSkillExtractionService],
  exports: [JobsService],
})
export class JobsModule {}
