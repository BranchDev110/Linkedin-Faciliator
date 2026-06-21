import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as mammoth from 'mammoth';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Resume as ResumeModel,
  ResumeDocument,
} from '../database/schemas/resume.schema';
import { ProfilesService } from '../profiles/profiles.service';
import { ApplicationsService } from '../applications/applications.service';
import { FileStorageService } from '../storage/file-storage.service';
import { GenerateResumeDto, Resume } from './dto/resume.dto';
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
    @InjectModel(ResumeModel.name)
    private resumeModel: Model<ResumeDocument>,
    private profilesService: ProfilesService,
    private applicationsService: ApplicationsService,
    private fileStorageService: FileStorageService,
    private resumeBulletService: ResumeBulletService,
    private resumeContentService: ResumeContentService,
    private resumeTemplateService: ResumeTemplateService,
  ) {}

  async findAllByUser(userId: string): Promise<Resume[]> {
    const docs = await this.resumeModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map((doc) => this.toResume(doc));
  }

  async findOne(userId: string, resumeId: string): Promise<Resume> {
    const doc = await this.resumeModel.findById(resumeId).exec();
    if (!doc) {
      throw new NotFoundException('Resume not found');
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toResume(doc);
  }

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

  async generate(userId: string, dto: GenerateResumeDto): Promise<Resume> {
    const [profile, application] = await Promise.all([
      this.profilesService.findOne(userId, dto.profileId),
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

    if (sections.usage) {
      await this.applicationsService.recordAiCost(
        dto.applicationId,
        userId,
        'resumeContent',
        sections.usage,
      );
    }

    const fillData = {
      summary: sections.summary,
      skills: sections.skills,
      skillMeta: skills,
      fallbackTitle: application.jobTitle,
      companyBullets: dto.companyBullets,
    };

    const isDocxTemplate = profile.resumeTemplateFormat === 'docx';
    let content = '';
    let outputFileName = `Resume_${profile.profileName.replace(/\s+/g, '_')}_${application.companyName.replace(/\s+/g, '_')}_${Date.now()}`;
    let fileBuffer: Buffer | string = '';
    const now = new Date().toISOString();

    if (isDocxTemplate) {
      const templateBuffer = this.fileStorageService.read(
        profile.resumeTemplateFilePath,
      );
      const filledDocx = this.resumeTemplateService.fillDocxTemplate(
        templateBuffer,
        fillData,
      );

      const extracted = await mammoth.extractRawText({ buffer: filledDocx });
      content = extracted.value;
      outputFileName += '.docx';
      fileBuffer = filledDocx;
    } else {
      content = this.resumeTemplateService.fillTemplate(
        profile.resumeTemplate,
        fillData,
      );
      outputFileName += '.txt';
      fileBuffer = content;
    }

    let doc: ResumeDocument | null = null;
    const existingResumeId = application.resumeId?.trim();

    if (existingResumeId) {
      const existingById = await this.resumeModel.findById(existingResumeId).exec();
      if (
        existingById &&
        existingById.userId === userId &&
        existingById.applicationId === dto.applicationId
      ) {
        doc = existingById;
      }
    }

    if (!doc) {
      doc = await this.resumeModel
        .findOne({ userId, applicationId: dto.applicationId })
        .exec();
    }

    if (doc) {
      doc.profileId = dto.profileId;
      doc.companyName = application.companyName;
      doc.jobTitle = application.jobTitle;
      doc.content = content;
      doc.outputFormat = isDocxTemplate ? 'docx' : 'text';
      doc.summary = sections.summary;
      doc.skillsSection = sections.skills;
      doc.fileName = outputFileName;
    } else {
      doc = await this.resumeModel.create({
        userId,
        applicationId: dto.applicationId,
        profileId: dto.profileId,
        companyName: application.companyName,
        jobTitle: application.jobTitle,
        content,
        outputFormat: isDocxTemplate ? 'docx' : 'text',
        summary: sections.summary,
        skillsSection: sections.skills,
        filePath: '',
        fileName: outputFileName,
        createdAt: now,
      });
    }

    const filePath = this.fileStorageService.saveResume(
      userId,
      doc._id.toString(),
      outputFileName,
      fileBuffer,
    );

    doc.filePath = filePath;
    await doc.save();

    await this.applicationsService.updateStatus(
      dto.applicationId,
      doc._id.toString(),
    );

    const updatedApplication = await this.applicationsService.findOne(
      userId,
      dto.applicationId,
    );

    return {
      ...this.toResume(doc),
      applicationAiCostUsd: updatedApplication.aiCostUsd ?? 0,
    };
  }

  async generateBullets(
    userId: string,
    dto: GenerateResumeBulletsDto,
  ): Promise<GenerateResumeBulletsResponse> {
    const profile = await this.profilesService.findOne(userId, dto.profileId);

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
    const profile = await this.profilesService.findOne(userId, dto.profileId);

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

  private toResume(doc: ResumeDocument): Resume {
    const data = doc.toObject();
    return {
      id: doc._id.toString(),
      userId: data.userId,
      applicationId: data.applicationId,
      profileId: data.profileId,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      content: data.content,
      outputFormat: data.outputFormat,
      summary: data.summary,
      skillsSection: data.skillsSection,
      filePath: data.filePath,
      fileName: data.fileName,
      fileUrl: data.filePath
        ? this.fileStorageService.buildDownloadUrl(data.filePath)
        : '',
      createdAt: data.createdAt,
    };
  }
}
