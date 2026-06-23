import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationSkills } from '../../applications/dto/application.dto';
import { OpenAiUsageRecord } from '../../openai/openai-usage.types';

export class GenerateResumeBulletsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  profileId?: string;

  @IsString()
  @MinLength(1)
  companyName!: string;

  @IsObject()
  skills!: ApplicationSkills;

  @IsOptional()
  @IsInt()
  @Min(1)
  bulletCount?: number;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  targetJobCompany?: string;

  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;
}

export class GenerateAllResumeBulletsCompanyDto {
  @IsString()
  @MinLength(1)
  companyName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bulletCount?: number;
}

export class GenerateAllResumeBulletsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  profileId?: string;

  @IsObject()
  skills!: ApplicationSkills;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateAllResumeBulletsCompanyDto)
  companies!: GenerateAllResumeBulletsCompanyDto[];

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  targetJobCompany?: string;

  @IsOptional()
  @IsString()
  targetJobTitle?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;
}

export interface GenerateResumeBulletsResponse {
  company: string;
  bullets: string[];
  costUsd?: number;
  usage?: OpenAiUsageRecord | null;
  applicationAiCostUsd?: number;
}

export interface GenerateAllResumeBulletsResponse {
  results: GenerateResumeBulletsResponse[];
  costUsd?: number;
  usage?: OpenAiUsageRecord | null;
  applicationAiCostUsd?: number;
}
