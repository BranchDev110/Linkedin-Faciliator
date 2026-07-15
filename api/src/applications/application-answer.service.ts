import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Profile } from '../profiles/dto/profile.dto';
import { usageFromCompletion } from '../openai/openai-cost.util';
import { resolveOpenAiModel } from '../openai/openai-model.util';
import { OpenAiUsageRecord } from '../openai/openai-usage.types';
import { GenerateApplicationAnswerResponse } from './dto/generate-answer.dto';

@Injectable()
export class ApplicationAnswerService {
  private readonly logger = new Logger(ApplicationAnswerService.name);
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateAnswer(
    profile: Profile,
    input: {
      question: string;
      jobDescription: string;
      targetJobCompany?: string;
      targetJobTitle?: string;
    },
  ): Promise<GenerateApplicationAnswerResponse> {
    const question = input.question.trim();
    const jobDescription = input.jobDescription.trim();

    if (!this.openai) {
      this.logger.warn('OPENAI_API_KEY not set; cannot generate application answer');
      throw new ServiceUnavailableException(
        'OpenAI is not configured. Set OPENAI_API_KEY and restart the API.',
      );
    }

    const candidateName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const companyDetails = (profile.companies || [])
      .map((company) => {
        const prompt = company.prompt?.trim();
        if (!prompt) {
          return `Company: ${company.name}\nProduct/experience details: (none provided)`;
        }
        return `Company: ${company.name}\nProduct/experience details:\n${prompt}`;
      })
      .join('\n\n');

    const systemPrompt = `You are an expert career coach helping a candidate answer job application and screening questions.

Rules:
1. Return valid JSON only with this shape: {"answer":"..."}
2. Write a concise, professional first-person answer suitable for pasting into an application form
3. Ground the answer in the job description and the candidate's configured company/product experience details
4. Prefer concrete examples from the company details when relevant; do not invent employers, products, metrics, or credentials
5. Match the tone and seniority implied by the target role
6. Keep the answer focused and scannable — typically 1–3 short paragraphs unless the question clearly asks for something longer`;

    const userPrompt = [
      'Write an application answer for the question below.',
      '',
      candidateName ? `Candidate: ${candidateName}` : '',
      profile.profileName ? `Profile: ${profile.profileName}` : '',
      '',
      'General writing instructions:',
      profile.generalPrompt?.trim() || '(none provided)',
      '',
      'Candidate company / product experience details:',
      companyDetails || '(none provided)',
      '',
      'Target job:',
      input.targetJobTitle ? `Title: ${input.targetJobTitle}` : '',
      input.targetJobCompany ? `Company: ${input.targetJobCompany}` : '',
      '',
      'Job description:',
      jobDescription,
      '',
      'Application question:',
      question,
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
      const answer = this.parseAnswer(content);

      return {
        answer,
        costUsd: usage?.costUsd ?? 0,
        usage,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error('OpenAI application answer generation failed', error);
      throw new ServiceUnavailableException(
        'Failed to generate an answer. Please try again.',
      );
    }
  }

  private parseAnswer(content: string | null | undefined): string {
    if (!content?.trim()) {
      return '';
    }

    try {
      const parsed = JSON.parse(content) as { answer?: unknown };
      if (typeof parsed.answer === 'string') {
        return parsed.answer.trim();
      }
    } catch {
      // Fall through to raw text cleanup.
    }

    return content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
}
