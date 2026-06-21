import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Application as ApplicationModel,
  ApplicationDocument,
} from '../database/schemas/application.schema';
import { ProfilesService } from '../profiles/profiles.service';
import {
  Application,
  ApplicationSkills,
  CreateApplicationDto,
  UpdateApplicationDto,
} from './dto/application.dto';
import {
  ExtractApplicationSkillsResponse,
} from './dto/extract-skills.dto';
import { JdSkillExtractionService } from './jd-skill-extraction.service';
import { JobSkillsService } from './job-skills.service';
import { normalizeApplicationStatus } from './application-status.util';
import { resolveLinkedInJobId } from './linkedin-job-id.util';
import {
  mergeCostBreakdown,
  roundUsd,
} from '../openai/openai-cost.util';
import {
  AiCostCategory,
  ApplicationAiCostBreakdown,
  OpenAiUsageRecord,
} from '../openai/openai-usage.types';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(ApplicationModel.name)
    private applicationModel: Model<ApplicationDocument>,
    private profilesService: ProfilesService,
    private jdSkillExtractionService: JdSkillExtractionService,
    private jobSkillsService: JobSkillsService,
  ) {}

  async findAllByUser(userId: string): Promise<Application[]> {
    const docs = await this.applicationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return docs.map((doc) => this.toApplication(doc));
  }

  async findOne(userId: string, applicationId: string): Promise<Application> {
    const doc = await this.applicationModel.findById(applicationId).exec();
    if (!doc) {
      throw new NotFoundException('Application not found');
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.toApplication(doc);
  }

  async findByLinkedInJobAndProfile(
    userId: string,
    linkedInJobId: string,
    profileId: string,
  ): Promise<Application | null> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId || !profileId.trim()) {
      return null;
    }

    const doc = await this.applicationModel
      .findOne({
        userId,
        profileId,
        linkedInJobId: normalizedJobId,
      })
      .sort({ updatedAt: -1 })
      .exec();

    return doc ? this.toApplication(doc) : null;
  }

  async findJobSkills(
    linkedInJobId: string,
  ): Promise<{ skills: ApplicationSkills; fromCache: true } | null> {
    const skills = await this.jobSkillsService.findByLinkedInJobId(linkedInJobId);
    if (!skills) {
      return null;
    }

    return { skills, fromCache: true };
  }

  async create(userId: string, dto: CreateApplicationDto): Promise<Application> {
    await this.profilesService.findOne(userId, dto.profileId);

    const linkedInJobIdForLookup = resolveLinkedInJobId(
      dto.linkedInJobId,
      dto.linkedInJobUrl,
      dto.jobUrl,
    );
    if (linkedInJobIdForLookup && dto.profileId) {
      const existing = await this.findByLinkedInJobAndProfile(
        userId,
        linkedInJobIdForLookup,
        dto.profileId,
      );
      if (existing) {
        return this.update(userId, existing.id, dto);
      }
    }

    let skills: ApplicationSkills | undefined;
    let hardSkills = dto.hardSkills || [];
    let competencies = dto.competencies || [];
    let skillExtractionCostUsd = dto.pendingSkillExtractionCostUsd ?? 0;

    if (!dto.skipSkillExtraction) {
      const extraction = await this.jdSkillExtractionService.extractSkills(
        dto.jobDescription,
        dto.companyName,
      );
      skills = extraction.skills;
      skillExtractionCostUsd = roundUsd(
        skillExtractionCostUsd + (extraction.usage?.costUsd ?? 0),
      );
      hardSkills = this.jdSkillExtractionService.parseSkillString(
        skills.hardSkills,
      );
      competencies = this.jdSkillExtractionService.parseSkillString(
        skills.competencies,
      );
    } else if (dto.skills) {
      skills = dto.skills;
      hardSkills = this.jdSkillExtractionService.parseSkillString(
        skills.hardSkills,
      );
      competencies = this.jdSkillExtractionService.parseSkillString(
        skills.competencies,
      );
    }

    const aiCostBreakdown =
      skillExtractionCostUsd > 0
        ? mergeCostBreakdown(undefined, 'skillExtraction', skillExtractionCostUsd)
        : {};

    const linkedInJobUrl =
      dto.linkedInJobUrl?.trim() || dto.jobUrl?.trim() || '';
    const linkedInJobId = resolveLinkedInJobId(
      dto.linkedInJobId,
      dto.linkedInJobUrl,
      dto.jobUrl,
    );
    const realJobUrl = dto.realJobUrl?.trim() || '';

    const now = new Date().toISOString();
    const doc = await this.applicationModel.create({
      userId,
      profileId: dto.profileId,
      companyName: dto.companyName,
      jobTitle: dto.jobTitle,
      jobDescription: dto.jobDescription,
      hardSkills,
      competencies,
      skills: skills as Record<string, unknown> | undefined,
      jobUrl: linkedInJobUrl,
      linkedInJobUrl,
      linkedInJobId,
      realJobUrl,
      location: dto.location || '',
      companyLogoUrl: dto.companyLogoUrl || '',
      companyBullets: (dto.companyBullets || []).map((entry) => ({
        company: entry.company,
        bullets: entry.bullets || '',
      })),
      status: 'recorded',
      resumeId: dto.resumeId || '',
      aiCostUsd: skillExtractionCostUsd,
      aiCostBreakdown: aiCostBreakdown as Record<string, number>,
      createdAt: now,
      updatedAt: now,
    });

    if (linkedInJobId && skills) {
      await this.jobSkillsService.upsert(
        linkedInJobId,
        skills,
        skillExtractionCostUsd,
      );
    }

    return this.toApplication(doc);
  }

  async update(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    const existing = await this.findOne(userId, applicationId);
    await this.profilesService.findOne(userId, dto.profileId || existing.profileId);

    const linkedInJobUrl =
      dto.linkedInJobUrl?.trim() ||
      dto.jobUrl?.trim() ||
      existing.linkedInJobUrl ||
      existing.jobUrl ||
      '';
    const linkedInJobId =
      resolveLinkedInJobId(
        dto.linkedInJobId,
        dto.linkedInJobUrl,
        dto.jobUrl,
      ) ||
      existing.linkedInJobId ||
      resolveLinkedInJobId(undefined, linkedInJobUrl);
    const realJobUrl =
      dto.realJobUrl !== undefined
        ? dto.realJobUrl.trim()
        : existing.realJobUrl || '';

    let hardSkills = existing.hardSkills;
    let competencies = existing.competencies;
    let skills = existing.skills;

    if (dto.skills) {
      skills = dto.skills;
      hardSkills = this.jdSkillExtractionService.parseSkillString(
        dto.skills.hardSkills,
      );
      competencies = this.jdSkillExtractionService.parseSkillString(
        dto.skills.competencies,
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      jobUrl: linkedInJobUrl,
      linkedInJobUrl,
      linkedInJobId,
      realJobUrl,
      hardSkills,
      competencies,
      skills: skills as Record<string, unknown> | undefined,
    };

    if (dto.profileId !== undefined) updates.profileId = dto.profileId;
    if (dto.companyName !== undefined) updates.companyName = dto.companyName;
    if (dto.jobTitle !== undefined) updates.jobTitle = dto.jobTitle;
    if (dto.jobDescription !== undefined) {
      updates.jobDescription = dto.jobDescription;
    }
    if (dto.location !== undefined) updates.location = dto.location;
    if (dto.companyLogoUrl !== undefined) {
      updates.companyLogoUrl = dto.companyLogoUrl;
    }
    if (dto.companyBullets !== undefined) {
      updates.companyBullets = dto.companyBullets.map((entry) => ({
        company: entry.company,
        bullets: entry.bullets || '',
      }));
    }
    if (dto.resumeId !== undefined) updates.resumeId = dto.resumeId;

    const doc = await this.applicationModel
      .findByIdAndUpdate(applicationId, updates, { new: true })
      .exec();

    if (!doc) {
      throw new NotFoundException('Application not found');
    }

    if (dto.skills && linkedInJobId) {
      await this.jobSkillsService.upsert(linkedInJobId, dto.skills);
    }

    return this.toApplication(doc);
  }

  async markApplied(userId: string, applicationId: string): Promise<Application> {
    await this.findOne(userId, applicationId);

    const now = new Date().toISOString();
    const doc = await this.applicationModel
      .findByIdAndUpdate(
        applicationId,
        {
          status: 'applied',
          appliedAt: now,
          updatedAt: now,
        },
        { new: true },
      )
      .exec();

    if (!doc) {
      throw new NotFoundException('Application not found');
    }

    return this.toApplication(doc);
  }

  async markAppliedBulk(
    userId: string,
    applicationIds: string[],
  ): Promise<Application[]> {
    const uniqueIds = [...new Set(applicationIds.filter(Boolean))];
    const updated: Application[] = [];

    for (const applicationId of uniqueIds) {
      updated.push(await this.markApplied(userId, applicationId));
    }

    return updated;
  }

  async extractSkills(
    userId: string,
    jobDescription: string,
    companyName = '',
    applicationId?: string,
    linkedInJobId?: string,
  ): Promise<ExtractApplicationSkillsResponse> {
    const normalizedJobId = linkedInJobId?.trim() || '';
    if (normalizedJobId) {
      const cachedSkills = await this.jobSkillsService.findByLinkedInJobId(
        normalizedJobId,
      );
      if (cachedSkills) {
        let applicationAiCostUsd: number | undefined;
        if (applicationId) {
          const existing = await this.findOne(userId, applicationId);
          applicationAiCostUsd = existing.aiCostUsd ?? 0;
        }

        return {
          skills: cachedSkills,
          costUsd: 0,
          fromCache: true,
          applicationAiCostUsd,
        };
      }
    }

    const extraction = await this.jdSkillExtractionService.extractSkills(
      jobDescription,
      companyName,
    );

    if (normalizedJobId) {
      await this.jobSkillsService.upsert(
        normalizedJobId,
        extraction.skills,
        extraction.usage?.costUsd ?? 0,
      );
    }

    let applicationAiCostUsd: number | undefined;
    if (applicationId && extraction.usage) {
      applicationAiCostUsd = await this.recordAiCost(
        applicationId,
        userId,
        'skillExtraction',
        extraction.usage,
      );
    }

    return {
      skills: extraction.skills,
      costUsd: extraction.usage?.costUsd ?? 0,
      fromCache: false,
      applicationAiCostUsd,
    };
  }

  async recordAiCost(
    applicationId: string,
    userId: string,
    category: AiCostCategory,
    usage: OpenAiUsageRecord | null | undefined,
  ): Promise<number> {
    if (!usage || usage.costUsd <= 0) {
      const existing = await this.findOne(userId, applicationId);
      return existing.aiCostUsd ?? 0;
    }

    await this.findOne(userId, applicationId);

    const doc = await this.applicationModel.findById(applicationId).exec();
    if (!doc) {
      throw new NotFoundException('Application not found');
    }

    const aiCostBreakdown = mergeCostBreakdown(
      doc.aiCostBreakdown as ApplicationAiCostBreakdown | undefined,
      category,
      usage.costUsd,
    );
    const aiCostUsd = roundUsd((doc.aiCostUsd ?? 0) + usage.costUsd);

    await this.applicationModel
      .findByIdAndUpdate(applicationId, {
        aiCostUsd,
        aiCostBreakdown,
        updatedAt: new Date().toISOString(),
      })
      .exec();

    return aiCostUsd;
  }

  async updateStatus(
    applicationId: string,
    resumeId?: string,
  ) {
    const updates: Record<string, unknown> = {
      status: 'recorded',
      updatedAt: new Date().toISOString(),
    };
    if (resumeId) {
      updates.resumeId = resumeId;
    }

    await this.applicationModel.findByIdAndUpdate(applicationId, updates).exec();
  }

  private toApplication(doc: ApplicationDocument): Application {
    const data = doc.toObject();
    const linkedInJobUrl =
      data.linkedInJobUrl?.trim() || data.jobUrl?.trim() || '';

    return {
      id: doc._id.toString(),
      userId: data.userId,
      profileId: data.profileId,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      hardSkills: data.hardSkills,
      competencies: data.competencies,
      skills: data.skills as ApplicationSkills | undefined,
      jobUrl: linkedInJobUrl,
      linkedInJobUrl,
      linkedInJobId: data.linkedInJobId || resolveLinkedInJobId(undefined, linkedInJobUrl),
      realJobUrl: data.realJobUrl || '',
      location: data.location,
      companyLogoUrl: data.companyLogoUrl,
      companyBullets: Array.isArray(data.companyBullets)
        ? data.companyBullets.map((entry) => ({
            company: String(entry.company || ''),
            bullets: String(entry.bullets || ''),
          }))
        : [],
      status: normalizeApplicationStatus(data.status),
      resumeId: data.resumeId || undefined,
      aiCostUsd: data.aiCostUsd ?? 0,
      aiCostBreakdown: data.aiCostBreakdown as ApplicationAiCostBreakdown | undefined,
      createdAt: data.createdAt,
      appliedAt: this.resolveAppliedAt(data),
      updatedAt: data.updatedAt,
    };
  }

  private resolveAppliedAt(data: {
    status?: string;
    appliedAt?: string;
    updatedAt?: string;
  }): string | undefined {
    if (data.appliedAt?.trim()) {
      return data.appliedAt;
    }
    if (normalizeApplicationStatus(data.status) === 'applied' && data.updatedAt) {
      return data.updatedAt;
    }
    return undefined;
  }
}
