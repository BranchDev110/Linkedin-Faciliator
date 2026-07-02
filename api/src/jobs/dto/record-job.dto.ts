import { IsOptional, IsString, MinLength } from 'class-validator';

export class RecordJobDto {
  @IsString()
  @MinLength(1)
  linkedInJobId!: string;

  @IsString()
  @MinLength(1)
  jobDescription!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  linkedInJobUrl?: string;

  @IsOptional()
  @IsString()
  realJobUrl?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  companyLogoUrl?: string;
}
