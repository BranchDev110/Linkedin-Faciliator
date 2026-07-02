import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Job as JobModel,
  JobDocument,
} from '../database/schemas/job.schema';
import { ApplicationSkills } from '../applications/dto/application.dto';
import { JdSkillExtractionService } from '../applications/jd-skill-extraction.service';

export interface JobRecord {
  id: string;
  linkedInJobId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  skills: ApplicationSkills;
  hardSkills: string[];
  competencies: string[];
  linkedInJobUrl: string;
  realJobUrl: string;
  location: string;
  companyLogoUrl: string;
  extractionCostUsd: number;
  createdAt: string;
  updatedAt: string;
}

export type JobSummary = Omit<JobRecord, 'jobDescription' | 'skills'> & {
  hasSkills: boolean;
  hasJobDescription: boolean;
};

export interface RecordJobMetadataInput {
  linkedInJobId: string;
  jobDescription: string;
  companyName?: string;
  jobTitle?: string;
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
}

const JOB_SUMMARY_PROJECTION = {
  linkedInJobId: 1,
  companyName: 1,
  jobTitle: 1,
  jobDescription: 1,
  hardSkills: 1,
  competencies: 1,
  linkedInJobUrl: 1,
  realJobUrl: 1,
  location: 1,
  companyLogoUrl: 1,
  extractionCostUsd: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

type LeanJobDoc = {
  _id: { toString(): string };
  linkedInJobId: string;
  companyName: string;
  jobTitle: string;
  hardSkills?: string[];
  competencies?: string[];
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  extractionCostUsd?: number;
  createdAt: string;
  updatedAt: string;
  jobUrl?: string;
  skills?: unknown;
  jobDescription?: string;
};

export interface UpsertJobInput {
  linkedInJobId: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  skills: ApplicationSkills;
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  extractionCostUsd?: number;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(JobModel.name) private jobModel: Model<JobDocument>,
    private jdSkillExtractionService: JdSkillExtractionService,
  ) {}

  async findAll(): Promise<JobRecord[]> {
    const docs = await this.jobModel.find().sort({ updatedAt: -1 }).lean().exec();
    return docs.map((doc) => this.toJobRecord(doc as LeanJobDoc & JobDocument));
  }

  async findAllSummaries(): Promise<JobSummary[]> {
    const docs = await this.jobModel
      .find()
      .select(JOB_SUMMARY_PROJECTION)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    return docs.map((doc) => this.toJobSummary(doc as LeanJobDoc));
  }

  async findById(id: string): Promise<JobRecord | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    const doc = await this.jobModel.findById(normalizedId).lean().exec();
    return doc ? this.toJobRecord(doc as LeanJobDoc & JobDocument) : null;
  }

  async findSummariesByIds(ids: string[]): Promise<Map<string, JobSummary>> {
    const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const map = new Map<string, JobSummary>();
    if (!normalizedIds.length) {
      return map;
    }

    const docs = await this.jobModel
      .find({ _id: { $in: normalizedIds } })
      .select(JOB_SUMMARY_PROJECTION)
      .lean()
      .exec();

    for (const doc of docs) {
      const record = this.toJobSummary(doc as LeanJobDoc);
      map.set(record.id, record);
    }

    return map;
  }

  async findSummariesByLinkedInJobIds(
    linkedInJobIds: string[],
  ): Promise<Map<string, JobSummary>> {
    const normalizedIds = [
      ...new Set(linkedInJobIds.map((id) => id.trim()).filter(Boolean)),
    ];
    const map = new Map<string, JobSummary>();
    if (!normalizedIds.length) {
      return map;
    }

    const docs = await this.jobModel
      .find({ linkedInJobId: { $in: normalizedIds } })
      .select(JOB_SUMMARY_PROJECTION)
      .lean()
      .exec();

    for (const doc of docs) {
      const record = this.toJobSummary(doc as LeanJobDoc);
      map.set(record.linkedInJobId, record);
    }

    return map;
  }

  async findByIds(ids: string[]): Promise<Map<string, JobRecord>> {
    const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const map = new Map<string, JobRecord>();
    if (!normalizedIds.length) {
      return map;
    }

    const docs = await this.jobModel.find({ _id: { $in: normalizedIds } }).lean().exec();
    for (const doc of docs) {
      const record = this.toJobRecord(doc as LeanJobDoc & JobDocument);
      map.set(record.id, record);
    }

    return map;
  }

  async findByLinkedInJobIds(
    linkedInJobIds: string[],
  ): Promise<Map<string, JobRecord>> {
    const normalizedIds = [
      ...new Set(linkedInJobIds.map((id) => id.trim()).filter(Boolean)),
    ];
    const map = new Map<string, JobRecord>();
    if (!normalizedIds.length) {
      return map;
    }

    const docs = await this.jobModel
      .find({ linkedInJobId: { $in: normalizedIds } })
      .lean()
      .exec();
    for (const doc of docs) {
      const record = this.toJobRecord(doc as LeanJobDoc & JobDocument);
      map.set(record.linkedInJobId, record);
    }

    return map;
  }

  async lookupByLinkedInJobId(linkedInJobId: string): Promise<{
    found: boolean;
    hasJobDescription: boolean;
    hasSkills: boolean;
    skills: ApplicationSkills | null;
  } | null> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId) {
      return null;
    }

    const job = await this.findOneByLinkedInJobId(normalizedJobId);
    if (!job) {
      return {
        found: false,
        hasJobDescription: false,
        hasSkills: false,
        skills: null,
      };
    }

    const hasSkills = this.jobHasExtractedSkills(job);

    return {
      found: true,
      hasJobDescription: Boolean(job.jobDescription?.trim()),
      hasSkills,
      skills: hasSkills
        ? this.normalizeSkills(job.skills as ApplicationSkills)
        : null,
    };
  }

  async findByLinkedInJobId(
    linkedInJobId: string,
  ): Promise<ApplicationSkills | null> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId) {
      return null;
    }

    const jobDoc = await this.jobModel
      .findOne({ linkedInJobId: normalizedJobId })
      .exec();
    if (jobDoc?.skills) {
      return this.normalizeSkills(jobDoc.skills as unknown as ApplicationSkills);
    }

    return null;
  }

  async findOneByLinkedInJobId(linkedInJobId: string): Promise<JobRecord | null> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId) {
      return null;
    }

    const doc = await this.jobModel
      .findOne({ linkedInJobId: normalizedJobId })
      .lean()
      .exec();
    return doc ? this.toJobRecord(doc as LeanJobDoc & JobDocument) : null;
  }

  async recordMetadata(input: RecordJobMetadataInput): Promise<JobRecord> {
    const normalizedJobId = input.linkedInJobId.trim();
    const jobDescription = input.jobDescription.trim();

    if (!normalizedJobId) {
      throw new BadRequestException('linkedInJobId is required');
    }

    if (!jobDescription) {
      throw new BadRequestException('jobDescription is required');
    }

    const now = new Date().toISOString();
    const doc = await this.jobModel
      .findOneAndUpdate(
        { linkedInJobId: normalizedJobId },
        {
          $set: {
            linkedInJobId: normalizedJobId,
            companyName: input.companyName?.trim() || '',
            jobTitle: input.jobTitle?.trim() || '',
            jobDescription,
            linkedInJobUrl: input.linkedInJobUrl?.trim() || '',
            realJobUrl: input.realJobUrl?.trim() || '',
            location: input.location?.trim() || '',
            companyLogoUrl: input.companyLogoUrl?.trim() || '',
            updatedAt: now,
          },
          $setOnInsert: {
            skills: {},
            hardSkills: [],
            competencies: [],
            extractionCostUsd: 0,
            createdAt: now,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (!doc) {
      throw new Error('Failed to record job metadata');
    }

    return this.toJobRecord(doc);
  }

  async upsert(input: UpsertJobInput): Promise<JobRecord> {
    const normalizedJobId = input.linkedInJobId.trim();
    if (!normalizedJobId) {
      throw new Error('linkedInJobId is required');
    }

    const now = new Date().toISOString();
    const hardSkills = this.jdSkillExtractionService.parseSkillString(
      input.skills.hardSkills,
    );
    const competencies = this.jdSkillExtractionService.parseSkillString(
      input.skills.competencies,
    );

    const doc = await this.jobModel
      .findOneAndUpdate(
        { linkedInJobId: normalizedJobId },
        {
          linkedInJobId: normalizedJobId,
          companyName: input.companyName?.trim() || input.skills.companyName || '',
          jobTitle: input.jobTitle?.trim() || input.skills.title || input.skills.role || '',
          jobDescription: input.jobDescription?.trim() || '',
          skills: input.skills as unknown as Record<string, unknown>,
          hardSkills,
          competencies,
          linkedInJobUrl: input.linkedInJobUrl?.trim() || '',
          realJobUrl: input.realJobUrl?.trim() || '',
          location: input.location?.trim() || '',
          companyLogoUrl: input.companyLogoUrl?.trim() || '',
          extractionCostUsd: input.extractionCostUsd ?? 0,
          updatedAt: now,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (!doc) {
      throw new Error('Failed to upsert job');
    }

    return this.toJobRecord(doc);
  }

  private normalizeSkills(skills: ApplicationSkills): ApplicationSkills | null {
    if (!skills.hardSkills && !skills.competencies && !skills.role) {
      return null;
    }

    return skills;
  }

  private jobHasExtractedSkills(data: {
    hardSkills?: string[];
    competencies?: string[];
    skills?: unknown;
  }): boolean {
    if (data.hardSkills?.length || data.competencies?.length) {
      return true;
    }

    const skills = data.skills as ApplicationSkills | undefined;
    return Boolean(
      skills?.hardSkills?.trim() ||
        skills?.competencies?.trim() ||
        skills?.role?.trim() ||
        skills?.title?.trim(),
    );
  }

  private toJobSummary(doc: LeanJobDoc): JobSummary {
    const legacyJobUrl = doc.jobUrl?.trim() || '';

    return {
      id: doc._id.toString(),
      linkedInJobId: doc.linkedInJobId,
      companyName: doc.companyName,
      jobTitle: doc.jobTitle,
      hardSkills: doc.hardSkills ?? [],
      competencies: doc.competencies ?? [],
      linkedInJobUrl: doc.linkedInJobUrl?.trim() || legacyJobUrl,
      realJobUrl: doc.realJobUrl ?? '',
      location: doc.location ?? '',
      companyLogoUrl: doc.companyLogoUrl ?? '',
      extractionCostUsd: doc.extractionCostUsd ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      hasSkills: this.jobHasExtractedSkills(doc),
      hasJobDescription: Boolean(doc.jobDescription?.trim()),
    };
  }

  private toJobRecord(doc: LeanJobDoc | JobDocument): JobRecord {
    const data = ('toObject' in doc ? doc.toObject() : doc) as LeanJobDoc;
    const legacyJobUrl = data.jobUrl?.trim() || '';

    return {
      id: doc._id.toString(),
      linkedInJobId: data.linkedInJobId,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription ?? '',
      skills: data.skills as unknown as ApplicationSkills,
      hardSkills: data.hardSkills ?? [],
      competencies: data.competencies ?? [],
      linkedInJobUrl: data.linkedInJobUrl?.trim() || legacyJobUrl,
      realJobUrl: data.realJobUrl ?? '',
      location: data.location ?? '',
      companyLogoUrl: data.companyLogoUrl ?? '',
      extractionCostUsd: data.extractionCostUsd ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
