import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ApplicationsModule } from './applications/applications.module';
import { ResumesModule } from './resumes/resumes.module';
import { UsersModule } from './users/users.module';
import { SpaModule } from './spa/spa.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env'),
      ],
    }),
    AuthModule,
    DatabaseModule,
    StorageModule,
    UsersModule,
    ProfilesModule,
    ApplicationsModule,
    ResumesModule,
    SpaModule,
  ],
})
export class AppModule {}
