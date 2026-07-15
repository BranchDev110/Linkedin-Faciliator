import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { JobsModule } from '../jobs/jobs.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationAnswerService } from './application-answer.service';
import { JdSkillExtractionService } from './jd-skill-extraction.service';

@Module({
  imports: [DatabaseModule, ProfilesModule, JobsModule],
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    JdSkillExtractionService,
    ApplicationAnswerService,
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
