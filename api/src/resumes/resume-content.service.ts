import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ApplicationSkills } from '../applications/dto/application.dto';
import { ProfileCompany } from '../profiles/dto/profile.dto';
import { usageFromCompletion } from '../openai/openai-cost.util';
import { resolveOpenAiModel } from '../openai/openai-model.util';
import { OpenAiUsageRecord } from '../openai/openai-usage.types';

export interface CompanyBulletInput {
  company: string;
  bullets: string;
}

export interface GeneratedResumeSections {
  summary: string;
  skills: string;
  usage?: OpenAiUsageRecord | null;
}

@Injectable()
export class ResumeContentService {
  private readonly logger = new Logger(ResumeContentService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateSummaryAndSkills(input: {
    companyBullets: CompanyBulletInput[];
    profileCompanies: ProfileCompany[];
    candidateName?: string;
    skills: ApplicationSkills;
    jobDescription: string;
    targetJobTitle: string;
    targetJobCompany: string;
    generalPrompt?: string;
  }): Promise<GeneratedResumeSections> {
    if (!this.openai) {
      return this.fallbackSections(input);
    }

    const careerCompanies = input.profileCompanies
      .map((company) => company.name)
      .filter(Boolean);
    const companiesWithBullets = input.companyBullets
      .map((entry) => entry.company)
      .filter(Boolean);
    const allEmployers = [
      ...new Set([...careerCompanies, ...companiesWithBullets]),
    ];

    const experienceBlock = input.companyBullets
      .map(
        (entry) =>
          `${entry.company}:\n${entry.bullets || '(no bullets provided)'}`,
      )
      .join('\n\n');

    const systemPrompt = `You are an expert resume writer. Generate a tailored resume SUMMARY and SKILLS section for a specific job application.

Return valid JSON only:
{
  "summary": "3-4 sentence professional summary paragraph",
  "skills": "skills section text suitable to paste into a resume template"
}

Rules:
1. Summary must synthesize experience across the candidate's FULL career—all employers listed—not just the most recent company
2. When stating years of experience, reflect cumulative professional experience across the entire work history, not a single role
3. Highlight breadth and progression across multiple employers when relevant to the target job
4. Skills section should emphasize overlap between extracted JD skills and demonstrated experience across all company bullets
5. Use concise, ATS-friendly language
6. Skills can be grouped lines or bullet-style lines separated by newlines
7. Do not invent employers or tools not supported by the bullets or extracted skills
8. Follow any general resume instructions provided by the user`;

    const userPrompt = [
      `Target job: ${input.targetJobTitle} at ${input.targetJobCompany}`,
      '',
      input.candidateName ? `Candidate: ${input.candidateName}` : '',
      allEmployers.length
        ? `Full career employers (in profile order): ${allEmployers.join(', ')}`
        : '',
      '',
      input.generalPrompt
        ? `General resume instructions:\n${input.generalPrompt}`
        : '',
      '',
      'Experience bullets by company (use ALL sections—not only the first):',
      experienceBlock,
      '',
      'Extracted JD skills JSON:',
      JSON.stringify(input.skills, null, 2),
      '',
      'Job description:',
      input.jobDescription,
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
      if (!content) return this.fallbackSections(input);

      const parsed = JSON.parse(content) as Partial<GeneratedResumeSections>;
      const usage = usageFromCompletion(model, completion.usage);
      const fallback = this.fallbackSections(input);

      return {
        summary: parsed.summary?.trim() || fallback.summary,
        skills: parsed.skills?.trim() || fallback.skills,
        usage,
      };
    } catch (error) {
      this.logger.error('OpenAI summary/skills generation failed', error);
      return this.fallbackSections(input);
    }
  }

  private fallbackSections(input: {
    companyBullets: CompanyBulletInput[];
    profileCompanies?: ProfileCompany[];
    skills: ApplicationSkills;
    targetJobTitle: string;
    targetJobCompany: string;
  }): GeneratedResumeSections {
    const skillLines = [
      input.skills.hardSkills,
      input.skills.additionalHardSkills,
      input.skills.competencies,
    ]
      .filter(Boolean)
      .join('\n');

    const employers =
      input.profileCompanies?.map((company) => company.name).filter(Boolean) ||
      input.companyBullets.map((entry) => entry.company);

    return {
      summary: `Experienced professional applying for ${input.targetJobTitle} at ${input.targetJobCompany}, with a career spanning ${employers.join(', ')}.`,
      skills: skillLines || 'Skills aligned to the target role.',
      usage: null,
    };
  }
}
