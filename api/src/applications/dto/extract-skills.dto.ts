import { IsOptional, IsString, MinLength } from 'class-validator';
import { Application, ApplicationSkills } from './application.dto';

export class ExtractApplicationSkillsDto {
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

  @IsOptional()
  @IsString()
  profileId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  linkedInJobId?: string;
}

export interface ExtractApplicationSkillsResponse {
  skills: ApplicationSkills;
  costUsd: number;
  fromCache?: boolean;
  applicationAiCostUsd?: number;
  applicationId?: string;
  application?: Application;
}
