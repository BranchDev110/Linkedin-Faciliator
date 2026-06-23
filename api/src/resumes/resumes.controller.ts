import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../auth/auth-user.types';
import { ApprovedGuard } from '../auth/approved.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResumesService } from './resumes.service';
import { GenerateResumeDto } from './dto/resume.dto';
import {
  GenerateAllResumeBulletsDto,
  GenerateResumeBulletsDto,
} from './dto/generate-bullets.dto';

@Controller('resumes')
@UseGuards(JwtAuthGuard, ApprovedGuard)
export class ResumesController {
  constructor(private resumesService: ResumesService) {}

  @Post('generate')
  async generate(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateResumeDto,
  ) {
    return this.resumesService.generate(user.uid, dto);
  }

  @Post('generate-bullets')
  async generateBullets(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateResumeBulletsDto,
  ) {
    return this.resumesService.generateBullets(user.uid, dto);
  }

  @Post('generate-all-bullets')
  async generateAllBullets(
    @CurrentUser() user: AuthUser,
    @Body() dto: GenerateAllResumeBulletsDto,
  ) {
    return this.resumesService.generateAllBullets(user.uid, dto);
  }
}
