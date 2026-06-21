import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../database/schemas/user.schema';
import { LoginDto } from './dto/register.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      email,
      passwordHash,
      name: dto.name?.trim() || '',
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
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

    user.updatedAt = new Date().toISOString();
    await user.save();

    return this.buildAuthResponse(user);
  }

  async getUserById(uid: string) {
    const user = await this.userModel.findById(uid).exec();
    if (!user) {
      return null;
    }

    return this.toPublicUser(user);
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
