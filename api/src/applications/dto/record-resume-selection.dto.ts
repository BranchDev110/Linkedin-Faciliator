import { IsOptional, IsString, MinLength } from 'class-validator';

export class RecordResumeSelectionDto {
  @IsString()
  @MinLength(1)
  pageUrl!: string;

  @IsOptional()
  @IsString()
  resumeFolderName?: string;

  @IsOptional()
  @IsString()
  resumeFileName?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  linkedInJobId?: string;

  @IsOptional()
  @IsString()
  jobId?: string;
}
