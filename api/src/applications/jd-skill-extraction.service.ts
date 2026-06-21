import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import { ApplicationSkills } from './dto/application.dto';
import {
  mergeCostBreakdown,
  roundUsd,
  usageFromCompletion,
} from '../openai/openai-cost.util';
import { resolveOpenAiModel } from '../openai/openai-model.util';
import {
  AiCostCategory,
  OpenAiUsageRecord,
} from '../openai/openai-usage.types';

@Injectable()
export class JdSkillExtractionService {
  private readonly logger = new Logger(JdSkillExtractionService.name);
  private openai: OpenAI | null = null;
  private systemPrompt: string | null = null;
  private hardSkillsFile: string | null = null;
  private titleListFile: string | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('OpenAI skill extraction enabled');
    } else {
      this.logger.warn(
        'OPENAI_API_KEY not set. Place it in the repo root .env and restart the API.',
      );
    }
  }

  async extractSkills(
    jobDescription: string,
    companyName = '',
  ): Promise<{ skills: ApplicationSkills; usage: OpenAiUsageRecord | null }> {
    if (!this.openai) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured. Add it to the repo root .env and restart the API.',
      );
    }

    const systemPrompt = this.getSystemPrompt();
    const hardSkillsFile = this.getHardSkillsFile();
    const titleListFile = this.getTitleListFile();

    const userPrompt = [
      'Extract JD skills',
      '',
      'Job Description:',
      jobDescription,
      '',
      'Hard Skills File:',
      hardSkillsFile,
      '',
      'Title List File:',
      titleListFile,
      '',
      companyName ? `Company Name: ${companyName}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const model = resolveOpenAiModel(
        this.configService.get<string>('OPENAI_MODEL'),
      );
      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new ServiceUnavailableException(
          'OpenAI returned an empty response while extracting skills.',
        );
      }

      return {
        skills: this.parseSkillsResponse(content, companyName),
        usage: usageFromCompletion(model, completion.usage),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      this.logger.error('OpenAI skill extraction failed', error);
      this.throwOpenAiError(error);
    }
  }

  private throwOpenAiError(error: unknown): never {
    if (error && typeof error === 'object') {
      const record = error as { status?: number; message?: string };
      const status = record.status;
      const message = String(record.message || '');

      if (status === 429) {
        if (/quota|billing|insufficient/i.test(message)) {
          throw new ServiceUnavailableException(
            'OpenAI quota exceeded. Add billing credits at https://platform.openai.com/account/billing or update OPENAI_API_KEY in .env.',
          );
        }

        throw new ServiceUnavailableException(
          'OpenAI rate limit reached. Wait a moment and try again.',
        );
      }

      if (status === 401) {
        throw new ServiceUnavailableException(
          'OpenAI API key is invalid. Update OPENAI_API_KEY in .env and restart the API.',
        );
      }
    }

    throw new ServiceUnavailableException(
      'OpenAI skill extraction failed. Check the API server logs for details.',
    );
  }

  parseSkillString(value: string | undefined): string[] {
    if (!value?.trim()) return [];
    return value
      .split('&')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseSkillsResponse(raw: string, fallbackCompanyName: string): ApplicationSkills {
    const parsed = JSON.parse(raw) as Partial<ApplicationSkills>;

    return {
      role: parsed.role?.trim() || parsed.title?.trim() || '',
      title: parsed.title?.trim() || '',
      title1: parsed.title1?.trim() || parsed.title?.trim() || '',
      title2: parsed.title2?.trim() || parsed.title?.trim() || '',
      title3: parsed.title3?.trim() || '',
      title4: parsed.title4?.trim() || parsed.title3?.trim() || '',
      companyName: parsed.companyName?.trim() || fallbackCompanyName,
      focus: parsed.focus?.trim() || '',
      hardSkills: parsed.hardSkills?.trim() || '',
      additionalHardSkills: parsed.additionalHardSkills?.trim() || '',
      competencies: parsed.competencies?.trim() || '',
    };
  }

  private readDataFile(filename: string): string {
    const candidates = [
      join(__dirname, '..', 'data', filename),
      join(__dirname, 'data', filename),
      join(process.cwd(), 'dist', 'data', filename),
      join(process.cwd(), 'src', 'data', filename),
      join(process.cwd(), 'data', filename),
    ];

    for (const path of candidates) {
      try {
        return readFileSync(path, 'utf-8');
      } catch {
        // try next path
      }
    }

    throw new Error(`Missing data file: ${filename}`);
  }

  private getSystemPrompt(): string {
    if (!this.systemPrompt) {
      this.systemPrompt = this.readDataFile('jd-skill-extraction-system-prompt.txt');
    }
    return this.systemPrompt;
  }

  private getHardSkillsFile(): string {
    if (!this.hardSkillsFile) {
      this.hardSkillsFile = this.readDataFile('hard-skills.txt');
    }
    return this.hardSkillsFile;
  }

  private getTitleListFile(): string {
    if (!this.titleListFile) {
      this.titleListFile = this.readDataFile('title-list.txt');
    }
    return this.titleListFile;
  }
}
