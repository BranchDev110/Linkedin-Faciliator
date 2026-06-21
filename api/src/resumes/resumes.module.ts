import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ApplicationsModule } from '../applications/applications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import { AiResumeService } from './ai-resume.service';
import { ResumeBulletService } from './resume-bullet.service';
import { ResumeContentService } from './resume-content.service';
import { ResumeTemplateService } from './resume-template.service';

@Module({
  imports: [DatabaseModule, ProfilesModule, ApplicationsModule],
  controllers: [ResumesController],
  providers: [
    ResumesService,
    AiResumeService,
    ResumeBulletService,
    ResumeContentService,
    ResumeTemplateService,
  ],
  exports: [ResumesService],
})
export class ResumesModule {}
