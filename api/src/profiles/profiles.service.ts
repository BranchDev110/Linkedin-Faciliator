import {
  BadRequestException,
  ConflictException,
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

export interface ProfileDefaults {
  profileName?: string;
  email?: string;
  name?: string;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectModel(ProfileModel.name)
    private profileModel: Model<ProfileDocument>,
    private fileStorageService: FileStorageService,
  ) {}

  async findByUser(userId: string): Promise<Profile | null> {
    const doc = await this.profileModel.findOne({ userId }).exec();
    if (!doc) {
      return null;
    }

    return normalizeProfile(
      doc._id.toString(),
      doc.toObject() as unknown as Record<string, unknown>,
    );
  }

  async getOrCreateForUser(
    userId: string,
    defaults: ProfileDefaults = {},
  ): Promise<Profile> {
    const existing = await this.findByUser(userId);
    if (existing) {
      return existing;
    }

    const profileName =
      defaults.profileName?.trim() ||
      defaults.name?.trim() ||
      defaults.email?.split('@')[0]?.trim() ||
      'My Profile';
    const nameParts = defaults.name?.trim().split(/\s+/).filter(Boolean) || [];

    return this.create(userId, {
      profileName,
      email: defaults.email || '',
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
    });
  }

  async findAllByUser(userId: string): Promise<Profile[]> {
    const profile = await this.getOrCreateForUser(userId);
    return [profile];
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
    const existing = await this.findByUser(userId);
    if (existing) {
      throw new ConflictException('You already have a profile. Edit it instead.');
    }

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

  async remove(_userId: string, _profileId: string) {
    throw new BadRequestException('Your profile cannot be deleted.');
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
