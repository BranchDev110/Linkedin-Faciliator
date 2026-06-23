import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [FilesController],
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class StorageModule {}
