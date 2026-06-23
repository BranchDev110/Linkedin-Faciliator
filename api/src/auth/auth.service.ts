import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  User,
  UserDocument,
  UserRole,
  UserStatus,
} from '../database/schemas/user.schema';
import { ProfilesService } from '../profiles/profiles.service';
import { LoginDto } from './dto/register.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private profilesService: ProfilesService,
  ) {}

  async authenticate(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();

    if (existing) {
      return this.login(dto);
    }

    return this.register({
      email: dto.email,
      password: dto.password,
    });
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { role, status } = this.resolveRegistrationAccess(email);

    const user = await this.userModel.create({
      email,
      passwordHash,
      name: dto.name?.trim() || '',
      emailVerified: true,
      role,
      status,
      approvedAt: status === 'approved' ? now : '',
      approvedBy: status === 'approved' ? 'system' : '',
      createdAt: now,
      updatedAt: now,
    });

    await this.profilesService.getOrCreateForUser(user._id.toString(), {
      email: user.email,
      name: user.name,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if ((user.status || 'approved') === 'rejected') {
      throw new ForbiddenException('Your account was not approved');
    }

    user.updatedAt = new Date().toISOString();
    await user.save();

    await this.profilesService.getOrCreateForUser(user._id.toString(), {
      email: user.email,
      name: user.name,
    });

    return this.buildAuthResponse(user);
  }

  async getUserById(uid: string) {
    const user = await this.userModel.findById(uid).exec();
    if (!user) {
      return null;
    }

    return this.toPublicUser(user);
  }

  private resolveRegistrationAccess(email: string): {
    role: UserRole;
    status: UserStatus;
  } {
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();

    if (adminEmail && email === adminEmail) {
      return { role: 'admin', status: 'approved' };
    }

    return { role: 'user', status: 'pending' };
  }

  private buildAuthResponse(user: UserDocument) {
    const uid = user._id.toString();
    const payload = {
      sub: uid,
      email: user.email,
      name: user.name,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: UserDocument) {
    return {
      uid: user._id.toString(),
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      role: user.role || 'user',
      status: user.status || 'approved',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      approvedAt: user.approvedAt || undefined,
    };
  }
}
