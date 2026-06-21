import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from './schemas/user.schema';
import { Profile, ProfileSchema } from './schemas/profile.schema';
import { Application, ApplicationSchema } from './schemas/application.schema';
import { Resume, ResumeSchema } from './schemas/resume.schema';
import { JobSkills, JobSkillsSchema } from './schemas/job-skills.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri:
          configService.get<string>('MONGODB_URI') ||
          'mongodb://127.0.0.1:27017/li-facilitator',
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Profile.name, schema: ProfileSchema },
      { name: Application.name, schema: ApplicationSchema },
      { name: Resume.name, schema: ResumeSchema },
      { name: JobSkills.name, schema: JobSkillsSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
