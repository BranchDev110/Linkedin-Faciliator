import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Profile } from '../profiles/dto/profile.dto';
import { Application } from '../applications/dto/application.dto';
import { resolveOpenAiModel } from '../openai/openai-model.util';

@Injectable()
export class AiResumeService {
  private openai: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async generateTailoredResume(
    profile: Profile,
    application: Application,
  ): Promise<string> {
    if (!this.openai) {
      return this.generateFallbackResume(profile, application);
    }

    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const location = [profile.address?.city, profile.address?.state]
      .filter(Boolean)
      .join(', ');

    const prompt = `You are an expert resume writer. Create a tailored, ATS-friendly resume for the following job application.

## Candidate Profile
Profile Name: ${profile.profileName}
Name: ${fullName || profile.profileName}
Email: ${profile.email || 'N/A'}
Phone: ${profile.phoneNumber || 'N/A'}
Location: ${location || 'N/A'}
LinkedIn: ${profile.linkedin || 'N/A'}
Target Companies: ${profile.companies.map((c) => c.name).join(', ') || 'N/A'}

Custom Resume Instructions:
${profile.generalPrompt || 'N/A'}

## Target Job
Company: ${application.companyName}
Title: ${application.jobTitle}
Location: ${application.location || 'N/A'}
Required Hard Skills: ${application.hardSkills.join(', ')}
Required Competencies: ${application.competencies.join(', ')}

Job Description:
${application.jobDescription}

## Instructions
1. Tailor the resume to highlight relevant experience and skills for this specific role
2. Use keywords from the job description naturally
3. Quantify achievements where possible
4. Keep it professional and concise (1-2 pages worth of content)
5. Format as plain text with clear sections: CONTACT, SUMMARY, SKILLS, EXPERIENCE, EDUCATION
6. Do not fabricate experience - only reframe existing experience to match the role
7. Follow any custom resume instructions provided above`;

    const completion = await this.openai.chat.completions.create({
      model: resolveOpenAiModel(this.configService.get<string>('OPENAI_MODEL')),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    return (
      completion.choices[0]?.message?.content ||
      this.generateFallbackResume(profile, application)
    );
  }

  private generateFallbackResume(
    profile: Profile,
    application: Application,
  ): string {
    const fullName = [profile.firstName, profile.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const location = [profile.address?.city, profile.address?.state]
      .filter(Boolean)
      .join(', ');
    const relevantSkills = application.hardSkills.join(', ');

    return `
${(fullName || profile.profileName).toUpperCase()}
${location} | ${profile.phoneNumber || ''}
${profile.email || ''}
${profile.linkedin || ''}

PROFESSIONAL SUMMARY
${profile.generalPrompt || `Experienced professional targeting ${application.jobTitle} at ${application.companyName}.`}

SKILLS
${relevantSkills}

---
Tailored for: ${application.jobTitle} at ${application.companyName}
`.trim();
  }
}
