import { Injectable } from '@nestjs/common';
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
    const docs = await this.jobModel.find().sort({ updatedAt: -1 }).exec();
    return docs.map((doc) => this.toJobRecord(doc));
  }

  async findById(id: string): Promise<JobRecord | null> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return null;
    }

    const doc = await this.jobModel.findById(normalizedId).exec();
    return doc ? this.toJobRecord(doc) : null;
  }

  async findByIds(ids: string[]): Promise<Map<string, JobRecord>> {
    const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const map = new Map<string, JobRecord>();
    if (!normalizedIds.length) {
      return map;
    }

    const docs = await this.jobModel.find({ _id: { $in: normalizedIds } }).exec();
    for (const doc of docs) {
      const record = this.toJobRecord(doc);
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
      .exec();
    for (const doc of docs) {
      const record = this.toJobRecord(doc);
      map.set(record.linkedInJobId, record);
    }

    return map;
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
      .exec();
    return doc ? this.toJobRecord(doc) : null;
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

  private toJobRecord(doc: JobDocument): JobRecord {
    const data = doc.toObject();
    const legacyJobUrl = (data as { jobUrl?: string }).jobUrl?.trim() || '';

    return {
      id: doc._id.toString(),
      linkedInJobId: data.linkedInJobId,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      jobDescription: data.jobDescription,
      skills: data.skills as unknown as ApplicationSkills,
      hardSkills: data.hardSkills,
      competencies: data.competencies,
      linkedInJobUrl: data.linkedInJobUrl?.trim() || legacyJobUrl,
      realJobUrl: data.realJobUrl,
      location: data.location,
      companyLogoUrl: data.companyLogoUrl,
      extractionCostUsd: data.extractionCostUsd ?? 0,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}
