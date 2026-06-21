import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApplicationAiCostBreakdown } from '../../openai/openai-usage.types';
import { ApplicationStatus } from '../application-status.util';

export interface ApplicationSkills {
  role: string;
  title: string;
  title1: string;
  title2: string;
  title3: string;
  title4: string;
  companyName: string;
  focus: string;
  hardSkills: string;
  additionalHardSkills: string;
  competencies: string;
}

export class ApplicationCompanyBulletsDto {
  @IsString()
  @MinLength(1)
  company!: string;

  @IsString()
  bullets!: string;
}

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  profileId!: string;

  @IsString()
  @MinLength(1)
  companyName!: string;

  @IsString()
  @MinLength(1)
  jobTitle!: string;

  @IsString()
  jobDescription!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hardSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competencies?: string[];

  @IsOptional()
  @IsString()
  jobUrl?: string;

  @IsOptional()
  @IsString()
  linkedInJobUrl?: string;

  @IsOptional()
  @IsString()
  linkedInJobId?: string;

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
  @IsBoolean()
  skipSkillExtraction?: boolean;

  @IsOptional()
  @IsObject()
  skills?: ApplicationSkills;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pendingSkillExtractionCostUsd?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationCompanyBulletsDto)
  companyBullets?: ApplicationCompanyBulletsDto[];

  @IsOptional()
  @IsString()
  resumeId?: string;
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  profileId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  jobTitle?: string;

  @IsOptional()
  @IsString()
  jobDescription?: string;

  @IsOptional()
  @IsString()
  jobUrl?: string;

  @IsOptional()
  @IsString()
  linkedInJobUrl?: string;

  @IsOptional()
  @IsString()
  linkedInJobId?: string;

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
  @IsObject()
  skills?: ApplicationSkills;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationCompanyBulletsDto)
  companyBullets?: ApplicationCompanyBulletsDto[];

  @IsOptional()
  @IsString()
  resumeId?: string;
}

export class MarkApplicationsAppliedDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

export interface ApplicationCompanyBullets {
  company: string;
  bullets: string;
}

export interface Application {
  id: string;
  userId: string;
  profileId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  hardSkills: string[];
  competencies: string[];
  jobUrl?: string;
  linkedInJobUrl?: string;
  linkedInJobId?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  companyBullets?: ApplicationCompanyBullets[];
  skills?: ApplicationSkills;
  resumeId?: string;
  status: ApplicationStatus;
  aiCostUsd?: number;
  aiCostBreakdown?: ApplicationAiCostBreakdown;
  createdAt: string;
  appliedAt?: string;
  updatedAt: string;
}
