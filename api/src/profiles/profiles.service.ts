import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Profile as ProfileModel,
  ProfileDocument,
} from '../database/schemas/profile.schema';
import { FileStorageService } from '../storage/file-storage.service';
import {
  CreateProfileDto,
  Profile,
  UpdateProfileDto,
} from './dto/profile.dto';
import {
  normalizeProfile,
  serializeCompanies,
} from './profile-normalizer';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(ProfileModel.name)
    private profileModel: Model<ProfileDocument>,
    private fileStorageService: FileStorageService,
  ) {}

  async findAllByUser(userId: string): Promise<Profile[]> {
    const docs = await this.profileModel.find({ userId }).exec();
    const profiles = docs.map((doc) =>
      normalizeProfile(doc._id.toString(), doc.toObject() as unknown as Record<string, unknown>),
    );

    return profiles.sort((a, b) =>
      String(a.profileName || '').localeCompare(String(b.profileName || '')),
    );
  }

  async findOne(userId: string, profileId: string): Promise<Profile> {
    const doc = await this.profileModel.findById(profileId).exec();
    if (!doc) {
      throw new NotFoundException('Profile not found');
    }

    const profile = normalizeProfile(
      doc._id.toString(),
      doc.toObject() as unknown as Record<string, unknown>,
    );
    if (profile.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return profile;
  }

  async create(userId: string, dto: CreateProfileDto): Promise<Profile> {
    const doc = await this.profileModel.create({
      userId,
      profileName: dto.profileName,
      firstName: dto.firstName || '',
      lastName: dto.lastName || '',
      email: dto.email || '',
      phoneNumber: dto.phoneNumber || '',
      linkedin: dto.linkedin || '',
      generalPrompt: dto.generalPrompt || '',
      companies: serializeCompanies(dto.companies),
      resumeTemplate: '',
      resumeTemplateFileName: '',
      resumeTemplateFormat: '',
      resumeTemplateFilePath: '',
      address: {
        city: dto.address?.city || '',
        state: dto.address?.state || '',
      },
    });

    return normalizeProfile(
      doc._id.toString(),
      doc.toObject() as unknown as Record<string, unknown>,
    );
  }

  async update(
    userId: string,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<Profile> {
    await this.findOne(userId, profileId);

    const updates: Record<string, unknown> = {};

    const scalarFields = [
      'profileName',
      'firstName',
      'lastName',
      'email',
      'phoneNumber',
      'linkedin',
      'generalPrompt',
    ] as const;

    for (const field of scalarFields) {
      if (dto[field] !== undefined) {
        updates[field] = dto[field];
      }
    }

    if (dto.companies !== undefined) {
      updates.companies = serializeCompanies(dto.companies);
    }

    if (dto.address !== undefined) {
      updates.address = {
        city: dto.address.city || '',
        state: dto.address.state || '',
      };
    }

    await this.profileModel.findByIdAndUpdate(profileId, updates).exec();
    return this.findOne(userId, profileId);
  }

  async remove(userId: string, profileId: string) {
    await this.findOne(userId, profileId);
    await this.profileModel.findByIdAndDelete(profileId).exec();
    return { deleted: true };
  }

  async uploadResumeTemplate(
    userId: string,
    profileId: string,
    options: {
      format: 'text' | 'docx';
      template?: string;
      templateDocxBase64?: string;
      fileName?: string;
    },
  ): Promise<Profile> {
    await this.findOne(userId, profileId);

    if (options.format === 'docx') {
      if (!options.templateDocxBase64?.trim()) {
        throw new BadRequestException('A .docx template file is required.');
      }

      let templateBuffer: Buffer;
      try {
        templateBuffer = Buffer.from(options.templateDocxBase64, 'base64');
      } catch {
        throw new BadRequestException('Invalid .docx file encoding.');
      }

      if (!templateBuffer.length) {
        throw new BadRequestException('The uploaded .docx file is empty.');
      }

      const fileName = options.fileName?.trim() || 'resume-template.docx';
      const filePath = this.fileStorageService.saveTemplate(
        userId,
        profileId,
        fileName,
        templateBuffer,
      );

      await this.profileModel.findByIdAndUpdate(profileId, {
        resumeTemplate: '',
        resumeTemplateFileName: fileName,
        resumeTemplateFormat: 'docx',
        resumeTemplateFilePath: filePath,
      });
    } else {
      if (!options.template?.trim()) {
        throw new BadRequestException('A resume template is required.');
      }

      await this.profileModel.findByIdAndUpdate(profileId, {
        resumeTemplate: options.template,
        resumeTemplateFileName: options.fileName || '',
        resumeTemplateFormat: 'text',
        resumeTemplateFilePath: '',
      });
    }

    return this.findOne(userId, profileId);
  }
}
