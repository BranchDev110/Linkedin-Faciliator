import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ApplicationSkills } from '../applications/dto/application.dto';
import { Profile, ProfileCompany } from '../profiles/dto/profile.dto';
import { GenerateResumeBulletsResponse } from './dto/generate-bullets.dto';
import { usageFromCompletion } from '../openai/openai-cost.util';
import { resolveOpenAiModel } from '../openai/openai-model.util';
import { OpenAiUsageRecord } from '../openai/openai-usage.types';

@Injectable()
export class ResumeBulletService {
  private readonly logger = new Logger(ResumeBulletService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateBulletsForAllCompanies(
    profile: Profile,
    skills: ApplicationSkills,
    companies: { companyName: string; bulletCount: number }[],
    options: {
      jobDescription?: string;
      targetJobCompany?: string;
      targetJobTitle?: string;
    },
  ): Promise<{
    results: GenerateResumeBulletsResponse[];
    usage?: OpenAiUsageRecord | null;
  }> {
    const requests = companies.map((entry) => {
      const company = profile.companies.find(
        (item) => item.name === entry.companyName,
      );
      if (!company) {
        throw new NotFoundException(
          `Company "${entry.companyName}" not found in profile`,
        );
      }

      return {
        company,
        bulletCount: Math.max(1, entry.bulletCount ?? company.bulletCount ?? 1),
      };
    });

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set; returning empty bullets');
      return {
        results: requests.map(({ company, bulletCount }) => ({
          company: company.name,
          bullets: Array(bulletCount).fill(''),
          costUsd: 0,
        })),
        usage: null,
      };
    }

    const candidateName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const companyRequirements = requests
      .map(
        ({ company, bulletCount }) =>
          `- ${company.name}: exactly ${bulletCount} bullet${bulletCount === 1 ? '' : 's'}`,
      )
      .join('\n');

    const companyInstructions = requests
      .map(
        ({ company }) =>
          `${company.name} instructions:\n${company.prompt || '(none provided)'}`,
      )
      .join('\n\n');

    const systemPrompt = `You are an expert resume writer. Write tailored resume bullet points for multiple past employers in one response.

Rules:
1. Return valid JSON only with this shape: {"companies":[{"company":"Company Name","bullets":["bullet one","bullet two"]}]}
2. Include every requested company exactly once, using the exact company name provided
3. Generate exactly the requested number of bullets for each company
4. Each bullet should be one concise line, start with a strong action verb, and include measurable impact when possible
5. Follow the general resume instructions and each company's specific instructions
6. Align bullets with the extracted target job skills
7. Do not fabricate impossible metrics; reframe experience credibly for the target role
8. Do not repeat the same bullet wording across companies`;

    const userPrompt = [
      'Generate resume bullets for all companies listed below.',
      '',
      'Bullet counts per company:',
      companyRequirements,
      '',
      candidateName ? `Candidate: ${candidateName}` : '',
      profile.profileName ? `Profile: ${profile.profileName}` : '',
      '',
      'General resume instructions (apply to every bullet):',
      profile.generalPrompt || '(none provided)',
      '',
      'Company-specific instructions:',
      companyInstructions,
      '',
      'Target job:',
      options.targetJobTitle
        ? `Title: ${options.targetJobTitle}`
        : skills.title
          ? `Title: ${skills.title}`
          : '',
      options.targetJobCompany
        ? `Company: ${options.targetJobCompany}`
        : skills.companyName
          ? `Company: ${skills.companyName}`
          : '',
      skills.role ? `Role: ${skills.role}` : '',
      skills.focus ? `Focus: ${skills.focus}` : '',
      '',
      'Extracted skills JSON:',
      JSON.stringify(skills, null, 2),
      '',
      options.jobDescription
        ? `Job description:\n${options.jobDescription}`
        : '',
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
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      const usage = usageFromCompletion(model, completion.usage);

      if (!content) {
        return {
          results: requests.map(({ company, bulletCount }) => ({
            company: company.name,
            bullets: Array(bulletCount).fill(''),
            costUsd: 0,
          })),
          usage,
        };
      }

      const parsed = JSON.parse(content) as {
        companies?: { company?: string; bullets?: string[] }[];
      };
      const byCompany = new Map(
        (parsed.companies || []).map((entry) => [
          String(entry.company || '').trim(),
          entry.bullets || [],
        ]),
      );

      const results = requests.map(({ company, bulletCount }) => {
        const rawBullets = byCompany.get(company.name) || [];
        const bullets = rawBullets
          .map((bullet) => bullet.trim())
          .filter(Boolean)
          .slice(0, bulletCount);

        while (bullets.length < bulletCount) {
          bullets.push('');
        }

        return {
          company: company.name,
          bullets,
          costUsd: 0,
        };
      });

      const costUsd = usage?.costUsd ?? 0;
      if (costUsd > 0 && results.length > 0) {
        results[0].costUsd = costUsd;
      }

      return { results, usage };
    } catch (error) {
      this.logger.error('OpenAI batch resume bullet generation failed', error);
      return {
        results: requests.map(({ company, bulletCount }) => ({
          company: company.name,
          bullets: Array(bulletCount).fill(''),
          costUsd: 0,
        })),
        usage: null,
      };
    }
  }

  async generateBulletsForCompany(
    profile: Profile,
    companyName: string,
    skills: ApplicationSkills,
    options: {
      bulletCount?: number;
      jobDescription?: string;
      targetJobCompany?: string;
      targetJobTitle?: string;
    },
  ): Promise<GenerateResumeBulletsResponse> {
    const company = profile.companies.find((item) => item.name === companyName);
    if (!company) {
      throw new NotFoundException(`Company "${companyName}" not found in profile`);
    }

    const bulletCount = Math.max(
      1,
      options.bulletCount ?? company.bulletCount ?? 1,
    );

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set; returning empty bullets');
      return {
        company: company.name,
        bullets: Array(bulletCount).fill(''),
        costUsd: 0,
      };
    }

    const candidateName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const systemPrompt = `You are an expert resume writer. Write tailored resume bullet points for one past employer.

Rules:
1. Return valid JSON only with this shape: {"bullets":["bullet one","bullet two"]}
2. Generate exactly the requested number of bullets
3. Each bullet should be one concise line, start with a strong action verb, and include measurable impact when possible
4. Follow the general resume instructions and the company-specific instructions provided by the user
5. Align bullets with the extracted target job skills
6. Do not fabricate impossible metrics; reframe experience credibly for the target role
7. Do not repeat the same bullet wording`;

    const userPrompt = [
      `Generate ${bulletCount} resume bullet${bulletCount === 1 ? '' : 's'} for ${company.name}.`,
      '',
      candidateName ? `Candidate: ${candidateName}` : '',
      profile.profileName ? `Profile: ${profile.profileName}` : '',
      '',
      'General resume instructions (apply to every bullet):',
      profile.generalPrompt || '(none provided)',
      '',
      `Company-specific instructions for ${company.name}:`,
      company.prompt || '(none provided)',
      '',
      'Target job:',
      options.targetJobTitle
        ? `Title: ${options.targetJobTitle}`
        : skills.title
          ? `Title: ${skills.title}`
          : '',
      options.targetJobCompany
        ? `Company: ${options.targetJobCompany}`
        : skills.companyName
          ? `Company: ${skills.companyName}`
          : '',
      skills.role ? `Role: ${skills.role}` : '',
      skills.focus ? `Focus: ${skills.focus}` : '',
      '',
      'Extracted skills JSON:',
      JSON.stringify(skills, null, 2),
      '',
      options.jobDescription
        ? `Job description:\n${options.jobDescription}`
        : '',
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
        temperature: 0.4,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        return {
          company: company.name,
          bullets: Array(bulletCount).fill(''),
          costUsd: 0,
        };
      }

      const parsed = this.parseResponse(content, company, bulletCount);
      const usage = usageFromCompletion(model, completion.usage);

      return {
        ...parsed,
        costUsd: usage?.costUsd ?? 0,
        usage,
      };
    } catch (error) {
      this.logger.error('OpenAI resume bullet generation failed', error);
      return {
        company: company.name,
        bullets: Array(bulletCount).fill(''),
        costUsd: 0,
      };
    }
  }

  private parseResponse(
    raw: string,
    company: ProfileCompany,
    bulletCount: number,
  ): GenerateResumeBulletsResponse {
    const parsed = JSON.parse(raw) as { bullets?: string[] };
    const bullets = (parsed.bullets || [])
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, bulletCount);

    while (bullets.length < bulletCount) {
      bullets.push('');
    }

    return {
      company: company.name,
      bullets,
    };
  }
}
