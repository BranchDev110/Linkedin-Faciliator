import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ProfileAddressDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class ProfileCompanyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bulletCount?: number;
}

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  profileName!: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  generalPrompt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileCompanyDto)
  companies?: ProfileCompanyDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileAddressDto)
  address?: ProfileAddressDto;
}

export class UpdateProfileDto extends CreateProfileDto {}

export interface ProfileAddress {
  city: string;
  state: string;
}

export interface ProfileCompany {
  name: string;
  prompt: string;
  bulletCount: number;
}

export interface Profile {
  id: string;
  userId: string;
  profileName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  linkedin: string;
  generalPrompt: string;
  companies: ProfileCompany[];
  resumeTemplate: string;
  resumeTemplateFileName: string;
  resumeTemplateFormat: 'text' | 'docx' | '';
  resumeTemplateFilePath: string;
  address: ProfileAddress;
}
