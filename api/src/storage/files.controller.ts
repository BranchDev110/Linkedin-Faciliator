import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'fs';
import { extname } from 'path';
import { AuthUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FileStorageService } from './file-storage.service';

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private fileStorageService: FileStorageService) {}

  @Get(':encodedPath')
  downloadFile(
    @CurrentUser() user: AuthUser,
    @Param('encodedPath') encodedPath: string,
    @Res() res: Response,
  ) {
    const decodedPath = decodeURIComponent(encodedPath);
    this.assertUserOwnsPath(user.uid, decodedPath);

    const absolutePath = this.fileStorageService.resolvePath(decodedPath);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File not found');
    }

    const ext = extname(decodedPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.sendFile(absolutePath);
  }

  private assertUserOwnsPath(userId: string, relativePath: string): void {
    const normalized = relativePath.replace(/\\/g, '/');
    const allowedPrefixes = [`templates/${userId}/`, `resumes/${userId}/`];

    if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      throw new ForbiddenException('Access denied');
    }
  }
}
