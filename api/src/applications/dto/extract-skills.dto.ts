import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApplicationSkills } from './application.dto';

export class ExtractApplicationSkillsDto {
  @IsString()
  @MinLength(1)
  jobDescription!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

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
}
