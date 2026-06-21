import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UploadResumeTemplateDto {
  @ValidateIf((dto) => dto.format !== 'docx')
  @IsString()
  @MinLength(1)
  template?: string;

  @ValidateIf((dto) => dto.format === 'docx')
  @IsString()
  @MinLength(1)
  templateDocxBase64?: string;

  @IsEnum(['text', 'docx'])
  format!: 'text' | 'docx';

  @IsOptional()
  @IsString()
  fileName?: string;
}
