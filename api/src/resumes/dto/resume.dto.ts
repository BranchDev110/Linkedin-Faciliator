import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationSkills } from '../../applications/dto/application.dto';

export class CompanyBulletsDto {
  @IsString()
  @MinLength(1)
  company!: string;

  @IsString()
  bullets!: string;
}

export class GenerateResumeDto {
  @IsString()
  @MinLength(1)
  applicationId!: string;

  @IsString()
  @MinLength(1)
  profileId!: string;

  @IsObject()
  skills!: ApplicationSkills;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyBulletsDto)
  companyBullets!: CompanyBulletsDto[];
}

export interface Resume {
  id: string;
  userId: string;
  applicationId: string;
  profileId: string;
  companyName: string;
  jobTitle: string;
  content: string;
  outputFormat?: 'text' | 'docx';
  summary?: string;
  skillsSection?: string;
  filePath?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
  applicationAiCostUsd?: number;
}
