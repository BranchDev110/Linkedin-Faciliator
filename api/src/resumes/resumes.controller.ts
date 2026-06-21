import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ResumesService } from './resumes.service';
import { GenerateResumeDto } from './dto/resume.dto';
import {
  GenerateAllResumeBulletsDto,
  GenerateResumeBulletsDto,
} from './dto/generate-bullets.dto';

@Controller('resumes')
@UseGuards(JwtAuthGuard)
export class ResumesController {
  constructor(private resumesService: ResumesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.resumesService.findAllByUser(user.uid);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.resumesService.findOne(user.uid, id);
  }

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
