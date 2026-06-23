import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as mammoth from 'mammoth';
import { ProfilesService } from '../profiles/profiles.service';
import { ApplicationsService } from '../applications/applications.service';
import { FileStorageService } from '../storage/file-storage.service';
import { GenerateResumeDto, GenerateResumeResponse } from './dto/resume.dto';
import {
  GenerateAllResumeBulletsDto,
  GenerateAllResumeBulletsResponse,
  GenerateResumeBulletsDto,
  GenerateResumeBulletsResponse,
} from './dto/generate-bullets.dto';
import { ResumeBulletService } from './resume-bullet.service';
import { ResumeContentService } from './resume-content.service';
import { ResumeTemplateService } from './resume-template.service';

@Injectable()
export class ResumesService {
  constructor(
    private profilesService: ProfilesService,
    private applicationsService: ApplicationsService,
    private fileStorageService: FileStorageService,
    private resumeBulletService: ResumeBulletService,
    private resumeContentService: ResumeContentService,
    private resumeTemplateService: ResumeTemplateService,
  ) {}

  private profileHasTemplate(profile: {
    resumeTemplate?: string;
    resumeTemplateFormat?: string;
    resumeTemplateFilePath?: string;
  }): boolean {
    if (profile.resumeTemplateFormat === 'docx') {
      return Boolean(profile.resumeTemplateFilePath?.trim());
    }

    return Boolean(profile.resumeTemplate?.trim());
  }

  async generate(
    userId: string,
    dto: GenerateResumeDto,
  ): Promise<GenerateResumeResponse> {
    const profileId = dto.profileId?.trim()
      ? dto.profileId.trim()
      : (await this.profilesService.getOrCreateForUser(userId)).id;

    const [profile, application] = await Promise.all([
      this.profilesService.findOne(userId, profileId),
      this.applicationsService.findOne(userId, dto.applicationId),
    ]);

    if (!this.profileHasTemplate(profile)) {
      throw new BadRequestException(
        'This profile has no resume template. Upload one in the dashboard first.',
      );
    }

    if (!dto.companyBullets?.length) {
      throw new BadRequestException(
        'At least one company bullet section is required to generate a resume.',
      );
    }

    const skills = dto.skills || application.skills;
    if (!skills) {
      throw new BadRequestException(
        'Extracted skills are required. Run Extract Skills first.',
      );
    }

    const sections = await this.resumeContentService.generateSummaryAndSkills({
      companyBullets: dto.companyBullets,
      profileCompanies: profile.companies,
      candidateName: [profile.firstName, profile.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      skills,
      jobDescription: application.jobDescription,
      targetJobTitle: application.jobTitle,
      targetJobCompany: application.companyName,
      generalPrompt: profile.generalPrompt,
    });

    const fillData = {
      summary: sections.summary,
      skills: sections.skills,
      skillMeta: skills,
      fallbackTitle: application.jobTitle,
      companyBullets: dto.companyBullets,
    };

    const isDocxTemplate = profile.resumeTemplateFormat === 'docx';
    let outputFileName = `Resume_${profile.profileName.replace(/\s+/g, '_')}_${application.companyName.replace(/\s+/g, '_')}_${Date.now()}`;
    let fileBuffer: Buffer | string = '';

    if (isDocxTemplate) {
      const templateBuffer = this.fileStorageService.read(
        profile.resumeTemplateFilePath,
      );
      const filledDocx = this.resumeTemplateService.fillDocxTemplate(
        templateBuffer,
        fillData,
      );

      outputFileName += '.docx';
      fileBuffer = filledDocx;
    } else {
      const content = this.resumeTemplateService.fillTemplate(
        profile.resumeTemplate,
        fillData,
      );
      outputFileName += '.txt';
      fileBuffer = content;
    }

    const filePath = this.fileStorageService.saveResume(
      userId,
      dto.applicationId,
      outputFileName,
      fileBuffer,
    );
    const fileUrl = this.fileStorageService.buildDownloadUrl(filePath);

    await this.applicationsService.updateResumeGenerated(
      dto.applicationId,
      fileUrl,
    );

    const updatedApplication = await this.applicationsService.findOne(
      userId,
      dto.applicationId,
    );

    return {
      filePath,
      fileName: outputFileName,
      fileUrl,
      applicationAiCostUsd: updatedApplication.aiCostUsd ?? 0,
    };
  }

  async generateBullets(
    userId: string,
    dto: GenerateResumeBulletsDto,
  ): Promise<GenerateResumeBulletsResponse> {
    const profileId = dto.profileId?.trim()
      ? dto.profileId.trim()
      : (await this.profilesService.getOrCreateForUser(userId)).id;
    const profile = await this.profilesService.findOne(userId, profileId);

    const result = await this.resumeBulletService.generateBulletsForCompany(
      profile,
      dto.companyName,
      dto.skills,
      {
        bulletCount: dto.bulletCount,
        jobDescription: dto.jobDescription,
        targetJobCompany: dto.targetJobCompany,
        targetJobTitle: dto.targetJobTitle,
      },
    );

    let applicationAiCostUsd: number | undefined;
    if (dto.applicationId && result.usage) {
      applicationAiCostUsd = await this.applicationsService.recordAiCost(
        dto.applicationId,
        userId,
        'resumeBullets',
        result.usage,
      );
    }

    return {
      ...result,
      applicationAiCostUsd,
    };
  }

  async generateAllBullets(
    userId: string,
    dto: GenerateAllResumeBulletsDto,
  ): Promise<GenerateAllResumeBulletsResponse> {
    const profileId = dto.profileId?.trim()
      ? dto.profileId.trim()
      : (await this.profilesService.getOrCreateForUser(userId)).id;
    const profile = await this.profilesService.findOne(userId, profileId);

    const { results, usage } =
      await this.resumeBulletService.generateBulletsForAllCompanies(
        profile,
        dto.skills,
        dto.companies.map((entry) => {
          const company = profile.companies.find(
            (item) => item.name === entry.companyName,
          );
          return {
            companyName: entry.companyName,
            bulletCount:
              entry.bulletCount ?? company?.bulletCount ?? 1,
          };
        }),
        {
          jobDescription: dto.jobDescription,
          targetJobCompany: dto.targetJobCompany,
          targetJobTitle: dto.targetJobTitle,
        },
      );

    let applicationAiCostUsd: number | undefined;
    if (dto.applicationId && usage) {
      applicationAiCostUsd = await this.applicationsService.recordAiCost(
        dto.applicationId,
        userId,
        'resumeBullets',
        usage,
      );
    }

    const costUsd = usage?.costUsd ?? 0;
    const enrichedResults = results.map((result, index) => ({
      ...result,
      costUsd: index === 0 ? costUsd : 0,
      applicationAiCostUsd,
    }));

    return {
      results: enrichedResults,
      costUsd,
      usage,
      applicationAiCostUsd,
    };
  }
}
