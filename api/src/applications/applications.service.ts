import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
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
  ExtractApplicationSkillsDto,
  ExtractApplicationSkillsResponse,
} from './dto/extract-skills.dto';
import { JdSkillExtractionService } from './jd-skill-extraction.service';
import { JobRecord, JobsService } from '../jobs/jobs.service';
import { normalizeApplicationStatus } from './application-status.util';
import { resolveLinkedInJobId } from './linkedin-job-id.util';
import {
  mergeCostBreakdown,
  normalizeAiCostBreakdown,
  roundUsd,
  sumTrackedAiCostUsd,
} from '../openai/openai-cost.util';
import {
  AiCostCategory,
  ApplicationAiCostBreakdown,
  OpenAiUsageRecord,
} from '../openai/openai-usage.types';

type LegacyApplicationFields = {
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  hardSkills?: string[];
  competencies?: string[];
  skills?: Record<string, unknown>;
  jobUrl?: string;
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  resumeId?: string;
};

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectModel(ApplicationModel.name)
    private applicationModel: Model<ApplicationDocument>,
    private profilesService: ProfilesService,
    private jdSkillExtractionService: JdSkillExtractionService,
    private jobsService: JobsService,
  ) {}

  async findAllByUser(userId: string): Promise<Application[]> {
    const docs = await this.applicationModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();

    return this.mapDocuments(docs);
  }

  async findOne(userId: string, applicationId: string): Promise<Application> {
    const normalizedId = applicationId?.trim();
    if (!normalizedId || !isValidObjectId(normalizedId)) {
      throw new BadRequestException('Invalid application ID');
    }

    const doc = await this.applicationModel.findById(normalizedId).exec();
    if (!doc) {
      throw new NotFoundException('Application not found');
    }
    if (doc.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const [application] = await this.mapDocuments([doc]);
    return application;
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

    if (!doc) {
      return null;
    }

    const [application] = await this.mapDocuments([doc]);
    return application;
  }

  async findByJobForUser(
    userId: string,
    options: { jobId?: string; linkedInJobId?: string },
  ): Promise<Application | null> {
    const jobId = options.jobId?.trim();
    if (jobId) {
      const doc = await this.applicationModel
        .findOne({ userId, jobId })
        .sort({ updatedAt: -1 })
        .exec();

      if (doc) {
        const [application] = await this.mapDocuments([doc]);
        return application;
      }
    }

    const linkedInJobId = options.linkedInJobId?.trim();
    if (linkedInJobId) {
      const doc = await this.applicationModel
        .findOne({ userId, linkedInJobId })
        .sort({ updatedAt: -1 })
        .exec();

      if (doc) {
        const [application] = await this.mapDocuments([doc]);
        return application;
      }
    }

    return null;
  }

  async findByJobAndProfile(
    userId: string,
    profileId: string | undefined,
    options: { jobId?: string; linkedInJobId?: string },
  ): Promise<Application | null> {
    if (!profileId?.trim()) {
      return this.findByJobForUser(userId, options);
    }

    const normalizedProfileId = profileId.trim();
    const jobId = options.jobId?.trim();
    if (jobId) {
      const doc = await this.applicationModel
        .findOne({
          userId,
          profileId: normalizedProfileId,
          jobId,
        })
        .sort({ updatedAt: -1 })
        .exec();

      if (doc) {
        const [application] = await this.mapDocuments([doc]);
        return application;
      }
    }

    const linkedInJobId = options.linkedInJobId?.trim();
    if (linkedInJobId) {
      return this.findByLinkedInJobAndProfile(
        userId,
        linkedInJobId,
        normalizedProfileId,
      );
    }

    return null;
  }

  private async resolveProfileId(
    userId: string,
    profileId?: string,
  ): Promise<string> {
    if (profileId?.trim()) {
      const profile = await this.profilesService.findOne(userId, profileId.trim());
      return profile.id;
    }

    const profile = await this.profilesService.getOrCreateForUser(userId);
    return profile.id;
  }

  async mapDocuments(docs: ApplicationDocument[]): Promise<Application[]> {
    if (!docs.length) {
      return [];
    }

    const jobIds = docs.map((doc) => doc.jobId?.trim()).filter(Boolean) as string[];
    const linkedInJobIds = docs
      .filter((doc) => !doc.jobId?.trim() && doc.linkedInJobId?.trim())
      .map((doc) => doc.linkedInJobId.trim());

    const [jobsById, jobsByLinkedInId] = await Promise.all([
      this.jobsService.findByIds(jobIds),
      this.jobsService.findByLinkedInJobIds(linkedInJobIds),
    ]);

    return docs.map((doc) => {
      const data = doc.toObject() as LegacyApplicationFields & ApplicationDocument;
      const job =
        (doc.jobId?.trim() ? jobsById.get(doc.jobId.trim()) : undefined) ||
        (doc.linkedInJobId?.trim()
          ? jobsByLinkedInId.get(doc.linkedInJobId.trim())
          : undefined) ||
        null;

      return this.toApplication(doc._id.toString(), data, job);
    });
  }

  async findJobSkills(
    linkedInJobId: string,
  ): Promise<{ skills: ApplicationSkills; fromCache: true } | null> {
    const skills = await this.jobsService.findByLinkedInJobId(linkedInJobId);
    if (!skills) {
      return null;
    }

    return { skills, fromCache: true };
  }

  async create(userId: string, dto: CreateApplicationDto): Promise<Application> {
    const profileId = await this.resolveProfileId(userId, dto.profileId);
    await this.profilesService.findOne(userId, profileId);

    const linkedInJobUrl =
      dto.linkedInJobUrl?.trim() || dto.jobUrl?.trim() || '';
    const linkedInJobId = resolveLinkedInJobId(
      dto.linkedInJobId,
      dto.linkedInJobUrl,
      dto.jobUrl,
    );
    const realJobUrl = dto.realJobUrl?.trim() || '';
    const jobIdFromDto = dto.jobId?.trim();

    if (jobIdFromDto) {
      const existingByJobId = await this.findByJobForUser(userId, {
        jobId: jobIdFromDto,
      });
      if (existingByJobId) {
        return this.update(userId, existingByJobId.id, dto);
      }
    }

    if (linkedInJobId) {
      const existing =
        (await this.findByJobForUser(userId, { linkedInJobId })) ||
        (await this.findByLinkedInJobAndProfile(
          userId,
          linkedInJobId,
          profileId,
        ));
      if (existing) {
        return this.update(userId, existing.id, dto);
      }
    }

    let skills: ApplicationSkills | undefined;
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
    } else if (dto.skills) {
      skills = dto.skills;
    }

    const aiCostBreakdown = normalizeAiCostBreakdown(
      skillExtractionCostUsd > 0
        ? mergeCostBreakdown(undefined, 'skillExtraction', skillExtractionCostUsd)
        : {},
    );

    let jobId = dto.jobId?.trim() || '';
    if (linkedInJobId && skills) {
      const job = await this.jobsService.upsert({
        linkedInJobId,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        jobDescription: dto.jobDescription,
        skills,
        linkedInJobUrl,
        realJobUrl,
        location: dto.location || '',
        companyLogoUrl: dto.companyLogoUrl || '',
        extractionCostUsd: skillExtractionCostUsd,
      });
      jobId = job.id;
    }

    const parsedSkills = skills ? this.parseSkillsArrays(skills) : undefined;
    const now = new Date().toISOString();
    const doc = await this.applicationModel.create({
      userId,
      profileId,
      jobId,
      linkedInJobId,
      skills: skills as unknown as Record<string, unknown> | undefined,
      hardSkills: parsedSkills?.hardSkills ?? [],
      competencies: parsedSkills?.competencies ?? [],
      companyBullets: (dto.companyBullets || []).map((entry) => ({
        company: entry.company,
        bullets: entry.bullets || '',
      })),
      status: dto.status ?? (skills ? 'extracted' : 'recorded'),
      resumeUrl: dto.resumeUrl || '',
      aiCostUsd: sumTrackedAiCostUsd(aiCostBreakdown),
      aiCostBreakdown: aiCostBreakdown as Record<string, number>,
      createdAt: now,
      updatedAt: now,
    });

    const [application] = await this.mapDocuments([doc]);
    return application;
  }

  async update(
    userId: string,
    applicationId: string,
    dto: UpdateApplicationDto,
  ): Promise<Application> {
    const existing = await this.findOne(userId, applicationId);
    const profileId = dto.profileId
      ? await this.resolveProfileId(userId, dto.profileId)
      : existing.profileId;
    await this.profilesService.findOne(userId, profileId);

    const linkedInJobUrl =
      dto.linkedInJobUrl?.trim() ||
      dto.jobUrl?.trim() ||
      existing.linkedInJobUrl ||
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

    const skills =
      dto.skills ??
      existing.skills ??
      (linkedInJobId
        ? (await this.jobsService.findByLinkedInJobId(linkedInJobId)) ?? undefined
        : undefined);
    const companyName = dto.companyName ?? existing.companyName;
    const jobTitle = dto.jobTitle ?? existing.jobTitle;
    const jobDescription = dto.jobDescription ?? existing.jobDescription;
    const location = dto.location ?? existing.location ?? '';
    const companyLogoUrl = dto.companyLogoUrl ?? existing.companyLogoUrl ?? '';

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      linkedInJobId,
    };

    if (dto.profileId !== undefined) updates.profileId = profileId;
    if (dto.companyBullets !== undefined) {
      updates.companyBullets = dto.companyBullets.map((entry) => ({
        company: entry.company,
        bullets: entry.bullets || '',
      }));
    }
    if (dto.resumeUrl !== undefined) updates.resumeUrl = dto.resumeUrl;

    if (dto.skills) {
      const parsedSkills = this.parseSkillsArrays(dto.skills);
      updates.skills = dto.skills as unknown as Record<string, unknown>;
      updates.hardSkills = parsedSkills.hardSkills;
      updates.competencies = parsedSkills.competencies;
      updates.status = 'extracted';
    }

    if (linkedInJobId && skills) {
      const job = await this.jobsService.upsert({
        linkedInJobId,
        companyName,
        jobTitle,
        jobDescription,
        skills,
        linkedInJobUrl,
        realJobUrl,
        location,
        companyLogoUrl,
      });
      updates.jobId = job.id;
    }

    const doc = await this.applicationModel
      .findByIdAndUpdate(applicationId, updates, { new: true })
      .exec();

    if (!doc) {
      throw new NotFoundException('Application not found');
    }

    const [application] = await this.mapDocuments([doc]);
    return application;
  }

  async markApplied(userId: string, applicationId: string): Promise<Application> {
    const existing = await this.findOne(userId, applicationId);

    if (existing.status === 'applied') {
      return existing;
    }

    const hasResume =
      Boolean(existing.resumeUrl?.trim()) ||
      existing.status === 'resume_generated';

    if (!hasResume) {
      throw new BadRequestException(
        'Generate a resume before marking this application as applied.',
      );
    }

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

    const [application] = await this.mapDocuments([doc]);
    return application;
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
    dto: ExtractApplicationSkillsDto,
  ): Promise<ExtractApplicationSkillsResponse> {
    const normalizedJobId = dto.linkedInJobId?.trim() || '';

    if (normalizedJobId) {
      const cachedSkills = await this.jobsService.findByLinkedInJobId(
        normalizedJobId,
      );
      if (cachedSkills) {
        const job = await this.jobsService.findOneByLinkedInJobId(normalizedJobId);
        const applicationResult = await this.upsertApplicationForSkillExtraction(
          userId,
          dto,
          cachedSkills,
          {
            jobId: job?.id,
            linkedInJobId: normalizedJobId,
            usage: null,
            fromCache: true,
          },
        );

        return {
          skills: cachedSkills,
          costUsd: 0,
          fromCache: true,
          applicationAiCostUsd: applicationResult.applicationAiCostUsd,
          applicationId: applicationResult.application.id,
          application: applicationResult.application,
        };
      }
    }

    const extraction = await this.jdSkillExtractionService.extractSkills(
      dto.jobDescription,
      dto.companyName || '',
    );

    let jobId: string | undefined;
    if (normalizedJobId) {
      const job = await this.jobsService.upsert({
        linkedInJobId: normalizedJobId,
        companyName: dto.companyName,
        jobTitle: dto.jobTitle,
        jobDescription: dto.jobDescription,
        skills: extraction.skills,
        linkedInJobUrl: dto.linkedInJobUrl,
        realJobUrl: dto.realJobUrl,
        location: dto.location,
        companyLogoUrl: dto.companyLogoUrl,
        extractionCostUsd: extraction.usage?.costUsd ?? 0,
      });
      jobId = job.id;
    }

    const applicationResult = await this.upsertApplicationForSkillExtraction(
      userId,
      dto,
      extraction.skills,
      {
        jobId,
        linkedInJobId: normalizedJobId || undefined,
        usage: extraction.usage,
        fromCache: false,
      },
    );

    return {
      skills: extraction.skills,
      costUsd: extraction.usage?.costUsd ?? 0,
      fromCache: false,
      applicationAiCostUsd: applicationResult.applicationAiCostUsd,
      applicationId: applicationResult.application.id,
      application: applicationResult.application,
    };
  }

  private async upsertApplicationForSkillExtraction(
    userId: string,
    dto: ExtractApplicationSkillsDto,
    skills: ApplicationSkills,
    options: {
      jobId?: string;
      linkedInJobId?: string;
      usage?: OpenAiUsageRecord | null;
      fromCache: boolean;
    },
  ): Promise<{ application: Application; applicationAiCostUsd: number }> {
    const profileId = await this.resolveProfileId(userId, dto.profileId);

    let existing: Application | null = null;
    if (dto.applicationId?.trim()) {
      try {
        existing = await this.findOne(userId, dto.applicationId.trim());
      } catch {
        existing = null;
      }
    }

    if (!existing && (options.jobId || options.linkedInJobId)) {
      existing = await this.findByJobAndProfile(userId, profileId, {
        jobId: options.jobId,
        linkedInJobId: options.linkedInJobId,
      });
    }

    if (existing) {
      const applicationAiCostUsd = await this.persistExtractedSkills(
        existing.id,
        userId,
        skills,
        {
          jobId: options.jobId,
          linkedInJobId: options.linkedInJobId,
          usage: options.fromCache ? null : options.usage,
        },
      );
      const application = await this.findOne(userId, existing.id);
      return { application, applicationAiCostUsd };
    }

    const parsedSkills = this.parseSkillsArrays(skills);
    const aiCostBreakdown =
      !options.fromCache && options.usage && options.usage.costUsd > 0
        ? normalizeAiCostBreakdown(
            mergeCostBreakdown(undefined, 'skillExtraction', options.usage.costUsd),
          )
        : {};
    const aiCostUsd = sumTrackedAiCostUsd(aiCostBreakdown);
    const now = new Date().toISOString();

    const doc = await this.applicationModel.create({
      userId,
      profileId,
      jobId: options.jobId?.trim() || '',
      linkedInJobId: options.linkedInJobId?.trim() || '',
      skills: skills as unknown as Record<string, unknown>,
      hardSkills: parsedSkills.hardSkills,
      competencies: parsedSkills.competencies,
      companyBullets: [],
      status: 'extracted',
      resumeUrl: '',
      aiCostUsd,
      aiCostBreakdown: aiCostBreakdown as Record<string, number>,
      createdAt: now,
      updatedAt: now,
    });

    const [application] = await this.mapDocuments([doc]);
    return { application, applicationAiCostUsd: aiCostUsd };
  }

  async persistExtractedSkills(
    applicationId: string,
    userId: string,
    skills: ApplicationSkills,
    options?: {
      jobId?: string;
      linkedInJobId?: string;
      usage?: OpenAiUsageRecord | null;
    },
  ): Promise<number> {
    await this.findOne(userId, applicationId);

    const doc = await this.applicationModel.findById(applicationId).exec();
    if (!doc) {
      throw new NotFoundException('Application not found');
    }

    const parsedSkills = this.parseSkillsArrays(skills);
    const currentStatus = normalizeApplicationStatus(doc.status);
    const updates: Record<string, unknown> = {
      skills: skills as unknown as Record<string, unknown>,
      hardSkills: parsedSkills.hardSkills,
      competencies: parsedSkills.competencies,
      status:
        currentStatus === 'applied' || currentStatus === 'resume_generated'
          ? currentStatus
          : 'extracted',
      updatedAt: new Date().toISOString(),
    };

    if (options?.jobId) {
      updates.jobId = options.jobId;
    }
    if (options?.linkedInJobId) {
      updates.linkedInJobId = options.linkedInJobId;
    }

    if (options?.usage && options.usage.costUsd > 0) {
      const aiCostBreakdown = normalizeAiCostBreakdown(
        mergeCostBreakdown(
          doc.aiCostBreakdown as ApplicationAiCostBreakdown | undefined,
          'skillExtraction',
          options.usage.costUsd,
        ),
      );
      updates.aiCostBreakdown = aiCostBreakdown;
      updates.aiCostUsd = sumTrackedAiCostUsd(aiCostBreakdown);
    }

    await this.applicationModel.findByIdAndUpdate(applicationId, updates).exec();
    return (updates.aiCostUsd as number | undefined) ?? doc.aiCostUsd ?? 0;
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

    const aiCostBreakdown = normalizeAiCostBreakdown(
      mergeCostBreakdown(
        doc.aiCostBreakdown as ApplicationAiCostBreakdown | undefined,
        category,
        usage.costUsd,
      ),
    );
    const aiCostUsd = sumTrackedAiCostUsd(aiCostBreakdown);

    await this.applicationModel
      .findByIdAndUpdate(applicationId, {
        aiCostUsd,
        aiCostBreakdown,
        updatedAt: new Date().toISOString(),
      })
      .exec();

    return aiCostUsd;
  }

  async updateResumeGenerated(applicationId: string, resumeUrl: string) {
    await this.applicationModel.findByIdAndUpdate(applicationId, {
      resumeUrl,
      status: 'resume_generated',
      updatedAt: new Date().toISOString(),
    });
  }

  private parseSkillsArrays(skills: ApplicationSkills) {
    return {
      hardSkills: this.jdSkillExtractionService.parseSkillString(
        skills.hardSkills,
      ),
      competencies: this.jdSkillExtractionService.parseSkillString(
        skills.competencies,
      ),
    };
  }

  private toApplication(
    id: string,
    data: LegacyApplicationFields & {
      userId: string;
      profileId: string;
      jobId?: string;
      linkedInJobId?: string;
      companyBullets?: { company: string; bullets: string }[];
      status?: string;
      resumeUrl?: string;
      aiCostUsd?: number;
      aiCostBreakdown?: Record<string, number>;
      createdAt: string;
      appliedAt?: string;
      updatedAt: string;
    },
    job: JobRecord | null,
  ): Application {
    const legacyLinkedInJobUrl =
      data.linkedInJobUrl?.trim() || data.jobUrl?.trim() || '';
    const linkedInJobUrl = job?.linkedInJobUrl || legacyLinkedInJobUrl;
    const linkedInJobId =
      data.linkedInJobId?.trim() ||
      job?.linkedInJobId ||
      resolveLinkedInJobId(undefined, linkedInJobUrl);
    const applicationSkills = (data.skills ?? job?.skills) as
      | ApplicationSkills
      | undefined;

    return {
      id,
      userId: data.userId,
      profileId: data.profileId,
      jobId: data.jobId?.trim() || job?.id,
      linkedInJobId,
      companyName: job?.companyName ?? data.companyName ?? '',
      jobTitle: job?.jobTitle ?? data.jobTitle ?? '',
      jobDescription: job?.jobDescription ?? data.jobDescription ?? '',
      hardSkills: data.hardSkills?.length
        ? data.hardSkills
        : job?.hardSkills ?? [],
      competencies: data.competencies?.length
        ? data.competencies
        : job?.competencies ?? [],
      skills: applicationSkills,
      linkedInJobUrl,
      realJobUrl: job?.realJobUrl ?? data.realJobUrl ?? '',
      location: job?.location ?? data.location ?? '',
      companyLogoUrl: job?.companyLogoUrl ?? data.companyLogoUrl ?? '',
      companyBullets: Array.isArray(data.companyBullets)
        ? data.companyBullets.map((entry) => ({
            company: String(entry.company || ''),
            bullets: String(entry.bullets || ''),
          }))
        : [],
      status: normalizeApplicationStatus(data.status),
      resumeUrl: data.resumeUrl?.trim() || undefined,
      aiCostBreakdown: normalizeAiCostBreakdown(data.aiCostBreakdown),
      aiCostUsd: sumTrackedAiCostUsd(data.aiCostBreakdown),
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
