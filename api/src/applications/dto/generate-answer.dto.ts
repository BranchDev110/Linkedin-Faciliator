import { IsOptional, IsString, MinLength } from 'class-validator';
import { OpenAiUsageRecord } from '../../openai/openai-usage.types';

export class GenerateApplicationAnswerDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsString()
  @MinLength(1)
  jobDescription!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  profileId?: string;

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

export interface GenerateApplicationAnswerResponse {
  answer: string;
  costUsd?: number;
  usage?: OpenAiUsageRecord | null;
  applicationAiCostUsd?: number;
}
