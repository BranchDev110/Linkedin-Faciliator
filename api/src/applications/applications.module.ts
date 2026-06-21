import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { JdSkillExtractionService } from './jd-skill-extraction.service';
import { JobSkillsService } from './job-skills.service';

@Module({
  imports: [DatabaseModule, ProfilesModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, JdSkillExtractionService, JobSkillsService],
  exports: [ApplicationsService, JobSkillsService],
})
export class ApplicationsModule {}
