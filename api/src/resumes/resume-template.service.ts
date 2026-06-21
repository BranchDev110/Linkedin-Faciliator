import { Injectable } from '@nestjs/common';
import Docxtemplater from 'docxtemplater';
import { ApplicationSkills } from '../applications/dto/application.dto';
import { CompanyBulletInput } from './resume-content.service';
import { prepareDocxTemplateForRendering } from './docx-placeholder-fix';

@Injectable()
export class ResumeTemplateService {
  fillTemplate(
    template: string,
    data: {
      summary: string;
      skills: string;
      skillMeta?: ApplicationSkills;
      fallbackTitle?: string;
      companyBullets: CompanyBulletInput[];
    },
  ): string {
    let result = template;
    const meta = data.skillMeta;
    const headlineTitle = meta?.title?.trim() || data.fallbackTitle?.trim() || '';

    result = this.replaceToken(result, 'summary', data.summary);
    result = this.replaceToken(result, 'skills', data.skills);
    result = this.replaceToken(result, 'title', headlineTitle);
    result = this.replaceToken(result, 'title1', meta?.title1?.trim() || headlineTitle);
    result = this.replaceToken(result, 'title2', meta?.title2?.trim() || headlineTitle);
    result = this.replaceToken(result, 'title3', meta?.title3?.trim() || '');
    result = this.replaceToken(
      result,
      'title4',
      meta?.title4?.trim() || meta?.title3?.trim() || '',
    );

    data.companyBullets.forEach((entry, index) => {
      const formatted = this.formatBullets(entry.bullets);
      const experienceIndex = index + 1;

      result = this.replaceToken(result, `exp${experienceIndex}`, formatted);
      result = this.replaceToken(result, `exp${experienceIndex}_bullets`, formatted);
      result = this.replaceCompanyTokens(result, entry.company, formatted);
    });

    return result;
  }

  fillDocxTemplate(
    templateBuffer: Buffer,
    data: {
      summary: string;
      skills: string;
      skillMeta?: ApplicationSkills;
      fallbackTitle?: string;
      companyBullets: CompanyBulletInput[];
    },
  ): Buffer {
    const zip = prepareDocxTemplateForRendering(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '',
    });

    doc.render(this.buildDocxRenderData(data));
    return doc.getZip().generate({ type: 'nodebuffer' });
  }

  private buildDocxRenderData(data: {
    summary: string;
    skills: string;
    skillMeta?: ApplicationSkills;
    fallbackTitle?: string;
    companyBullets: CompanyBulletInput[];
  }): Record<string, string> {
    const meta = data.skillMeta;
    const headlineTitle = meta?.title?.trim() || data.fallbackTitle?.trim() || '';

    const renderData: Record<string, string> = {
      summary: data.summary ?? '',
      skills: data.skills ?? '',
      title: headlineTitle,
      title1: meta?.title1?.trim() || headlineTitle,
      title2: meta?.title2?.trim() || headlineTitle,
      title3: meta?.title3?.trim() || '',
      title4: meta?.title4?.trim() || meta?.title3?.trim() || '',
    };

    data.companyBullets.forEach((entry, index) => {
      const formatted = this.formatBullets(entry.bullets);
      const experienceIndex = index + 1;
      const experienceKey = `exp${experienceIndex}`;

      renderData[experienceKey] = formatted;
      renderData[`${experienceKey}_bullets`] = formatted;
      renderData[entry.company] = formatted;
      renderData[`company:${entry.company}`] = formatted;
    });

    return renderData;
  }

  private formatBullets(text: string): string {
    return text
      .split('\n')
      .map((line) => line.trim().replace(/^[-•*–—]\s*/, ''))
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join('\n');
  }

  private replaceToken(
    template: string,
    token: string,
    value: string,
  ): string {
    const pattern = new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'gi');
    return template.replace(pattern, value);
  }

  private replaceCompanyTokens(
    template: string,
    companyName: string,
    value: string,
  ): string {
    const escaped = this.escapeRegExp(companyName);
    const patterns = [
      new RegExp(`\\{\\{\\s*company\\s*:\\s*${escaped}\\s*\\}\\}`, 'gi'),
      new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi'),
    ];

    let result = template;
    for (const pattern of patterns) {
      result = result.replace(pattern, value);
    }
    return result;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
