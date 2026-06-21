import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  JobSkills as JobSkillsModel,
  JobSkillsDocument,
} from '../database/schemas/job-skills.schema';
import { ApplicationSkills } from './dto/application.dto';
import { JdSkillExtractionService } from './jd-skill-extraction.service';

@Injectable()
export class JobSkillsService {
  constructor(
    @InjectModel(JobSkillsModel.name)
    private jobSkillsModel: Model<JobSkillsDocument>,
    private jdSkillExtractionService: JdSkillExtractionService,
  ) {}

  async findByLinkedInJobId(
    linkedInJobId: string,
  ): Promise<ApplicationSkills | null> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId) {
      return null;
    }

    const doc = await this.jobSkillsModel
      .findOne({ linkedInJobId: normalizedJobId })
      .exec();

    if (!doc?.skills) {
      return null;
    }

    const skills = doc.skills as unknown as ApplicationSkills;
    if (!skills.hardSkills && !skills.competencies && !skills.role) {
      return null;
    }

    return skills;
  }

  async upsert(
    linkedInJobId: string,
    skills: ApplicationSkills,
    extractionCostUsd = 0,
  ): Promise<void> {
    const normalizedJobId = linkedInJobId.trim();
    if (!normalizedJobId) {
      return;
    }

    const now = new Date().toISOString();
    const hardSkills = this.jdSkillExtractionService.parseSkillString(
      skills.hardSkills,
    );
    const competencies = this.jdSkillExtractionService.parseSkillString(
      skills.competencies,
    );

    await this.jobSkillsModel
      .findOneAndUpdate(
        { linkedInJobId: normalizedJobId },
        {
          linkedInJobId: normalizedJobId,
          skills: skills as unknown as Record<string, unknown>,
          hardSkills,
          competencies,
          extractionCostUsd,
          updatedAt: now,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, new: true },
      )
      .exec();
  }
}
