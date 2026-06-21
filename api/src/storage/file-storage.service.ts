import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

@Injectable()
export class FileStorageService {
  private readonly root: string;

  constructor(private configService: ConfigService) {
    const configured = this.configService.get<string>('STORAGE_ROOT') || './storage';
    this.root = configured.startsWith('/')
      ? resolve(configured)
      : resolve(process.cwd(), '..', configured.replace(/^\.\//, ''));

    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  getRoot(): string {
    return this.root;
  }

  saveTemplate(
    userId: string,
    profileId: string,
    fileName: string,
    content: Buffer,
  ): string {
    const safeName = this.sanitizeFileName(fileName);
    const relativePath = join('templates', userId, profileId, safeName);
    this.writeBuffer(relativePath, content);
    return relativePath;
  }

  saveResume(
    userId: string,
    resumeId: string,
    fileName: string,
    content: Buffer | string,
  ): string {
    const safeName = this.sanitizeFileName(fileName);
    const relativePath = join('resumes', userId, resumeId, safeName);
    if (typeof content === 'string') {
      this.writeText(relativePath, content);
    } else {
      this.writeBuffer(relativePath, content);
    }
    return relativePath;
  }

  read(relativePath: string): Buffer {
    const absolutePath = this.resolvePath(relativePath);
    return readFileSync(absolutePath);
  }

  resolvePath(relativePath: string): string {
    return join(this.root, relativePath);
  }

  buildDownloadUrl(relativePath: string): string {
    const apiUrl =
      this.configService.get<string>('API_URL') || 'http://localhost:3001';
    return `${apiUrl.replace(/\/$/, '')}/files/${encodeURIComponent(relativePath)}`;
  }

  private writeBuffer(relativePath: string, content: Buffer): void {
    const absolutePath = this.resolvePath(relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  private writeText(relativePath: string, content: string): void {
    this.writeBuffer(relativePath, Buffer.from(content, 'utf8'));
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
  }
}
