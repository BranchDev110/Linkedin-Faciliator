import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Application as ApplicationModel,
  ApplicationDocument,
} from '../database/schemas/application.schema';
import {
  Profile as ProfileModel,
  ProfileDocument,
} from '../database/schemas/profile.schema';
import {
  User as UserModel,
  UserDocument,
  UserRole,
  UserStatus,
} from '../database/schemas/user.schema';
import { AuthUser } from '../auth/auth-user.types';
import { Application } from '../applications/dto/application.dto';
import { ApplicationsService } from '../applications/applications.service';
import { normalizeProfile } from '../profiles/profile-normalizer';

export interface AdminUserSummary {
  uid: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  profileCount: number;
  applicationCount: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
    @InjectModel(ProfileModel.name)     private profileModel: Model<ProfileDocument>,
    @InjectModel(ApplicationModel.name)
    private applicationModel: Model<ApplicationDocument>,
    private applicationsService: ApplicationsService,
  ) {}

  async listUsers(): Promise<AdminUserSummary[]> {
    const users = await this.userModel.find().sort({ createdAt: -1 }).exec();
    const summaries: AdminUserSummary[] = [];

    for (const user of users) {
      const uid = user._id.toString();
      const [profileCount, applicationCount] = await Promise.all([
        this.profileModel.countDocuments({ userId: uid }).exec(),
        this.applicationModel.countDocuments({ userId: uid }).exec(),
      ]);

      summaries.push({
        uid,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        status: user.status || 'approved',
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        approvedAt: user.approvedAt || undefined,
        profileCount,
        applicationCount,
      });
    }

    return summaries;
  }

  async updateUserStatus(
    admin: AuthUser,
    userId: string,
    status: UserStatus,
  ): Promise<AdminUserSummary> {
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin' && status !== 'approved') {
      throw new BadRequestException('Admin accounts must stay approved');
    }

    const now = new Date().toISOString();
    user.status = status;
    user.updatedAt = now;
    if (status === 'approved') {
      user.approvedAt = now;
      user.approvedBy = admin.uid;
    } else {
      user.approvedAt = '';
      user.approvedBy = '';
    }
    await user.save();

    const [profileCount, applicationCount] = await Promise.all([
      this.profileModel.countDocuments({ userId }).exec(),
      this.applicationModel.countDocuments({ userId }).exec(),
    ]);

    return {
      uid: userId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      approvedAt: user.approvedAt || undefined,
      profileCount,
      applicationCount,
    };
  }

  async updateUserRole(
    admin: AuthUser,
    userId: string,
    role: UserRole,
  ): Promise<AdminUserSummary> {
    if (!['user', 'admin'].includes(role)) {
      throw new BadRequestException('Invalid role');
    }

    if (admin.uid === userId && role !== 'admin') {
      throw new BadRequestException('You cannot remove your own admin role');
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'admin' && role === 'user') {
      const adminCount = await this.userModel
        .countDocuments({ role: 'admin' })
        .exec();
      if (adminCount <= 1) {
        throw new BadRequestException('At least one admin account is required');
      }
    }

    const now = new Date().toISOString();
    user.role = role;
    user.updatedAt = now;

    if (role === 'admin') {
      user.status = 'approved';
      user.approvedAt = user.approvedAt || now;
      user.approvedBy = user.approvedBy || admin.uid;
    }

    await user.save();

    const [profileCount, applicationCount] = await Promise.all([
      this.profileModel.countDocuments({ userId }).exec(),
      this.applicationModel.countDocuments({ userId }).exec(),
    ]);

    return {
      uid: userId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      approvedAt: user.approvedAt || undefined,
      profileCount,
      applicationCount,
    };
  }

  async listProfiles(userId?: string) {
    if (userId?.trim()) {
      return this.profileModel
        .find({ userId: userId.trim() })
        .sort({ profileName: 1 })
        .exec()
        .then((docs) =>
          docs.map((doc) =>
            normalizeProfile(
              doc._id.toString(),
              doc.toObject() as unknown as Record<string, unknown>,
            ),
          ),
        );
    }

    const docs = await this.profileModel.find().sort({ profileName: 1 }).exec();
    return docs.map((doc) =>
      normalizeProfile(
        doc._id.toString(),
        doc.toObject() as unknown as Record<string, unknown>,
      ),
    );
  }

  async listApplications(userId?: string, profileId?: string): Promise<Application[]> {
    const filter: Record<string, string> = {};
    if (userId?.trim()) {
      filter.userId = userId.trim();
    }
    if (profileId?.trim()) {
      filter.profileId = profileId.trim();
    }

    const docs = await this.applicationModel
      .find(filter)
      .sort({ createdAt: -1 })
      .exec();

    return this.applicationsService.mapDocuments(docs);
  }
}
