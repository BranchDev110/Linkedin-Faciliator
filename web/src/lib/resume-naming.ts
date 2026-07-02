import { filePathFromDownloadUrl } from './api';
import { Profile } from '../types';

function sanitizeResumeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Resume';
}

export function getCandidateDisplayName(
  profile: Pick<Profile, 'firstName' | 'lastName' | 'profileName'>,
): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || profile.profileName.trim() || 'Resume';
}

export function getResumeDocxFileName(
  profile: Pick<Profile, 'firstName' | 'lastName' | 'profileName'>,
): string {
  return `${sanitizeResumeFileName(getCandidateDisplayName(profile))}.docx`;
}

export function computeResumeStorageFolder(applicationId: string): string {
  const id = applicationId.trim().replace(/[^a-zA-Z0-9-]/g, '');
  return id ? `Resume_${id}` : 'Resume_Unknown';
}

export function parseResumeStoragePath(relativePath: string): {
  resumeFolderName: string;
  resumeFileName: string;
} | null {
  const parts = relativePath.split(/[/\\]/).filter(Boolean);
  if (parts.length < 4 || parts[0] !== 'resumes') {
    return null;
  }

  const resumeFileName = parts[parts.length - 1]?.trim();
  const applicationId = parts[parts.length - 2]?.trim();
  if (!applicationId || !resumeFileName) {
    return null;
  }

  return {
    resumeFolderName: computeResumeStorageFolder(applicationId),
    resumeFileName,
  };
}

export function getResumeDownloadPath(
  profile: Pick<Profile, 'firstName' | 'lastName' | 'profileName'>,
  resumeFolderName?: string,
  resumeFileName?: string,
): string {
  const fileName = resumeFileName?.trim() || getResumeDocxFileName(profile);
  if (resumeFolderName?.trim()) {
    return `${resumeFolderName.trim()}/${fileName}`;
  }

  return fileName;
}

export function resolveApplicationResumeFolder(application: {
  id?: string;
  resumeFolderName?: string;
  resumeUrl?: string;
}): string {
  const resumeUrl = application.resumeUrl?.trim();
  if (resumeUrl) {
    const parsed = parseResumeStoragePath(
      filePathFromDownloadUrl(resumeUrl),
    );
    if (parsed?.resumeFolderName) {
      return parsed.resumeFolderName;
    }
  }

  if (application.id?.trim()) {
    return computeResumeStorageFolder(application.id);
  }

  return application.resumeFolderName?.trim() || '';
}

export function resolveApplicationResumeFileName(
  application: { resumeFileName?: string; resumeUrl?: string },
  profile: Pick<Profile, 'firstName' | 'lastName' | 'profileName'>,
): string {
  const resumeUrl = application.resumeUrl?.trim();
  if (resumeUrl) {
    const parsed = parseResumeStoragePath(
      filePathFromDownloadUrl(resumeUrl),
    );
    if (parsed?.resumeFileName) {
      return parsed.resumeFileName;
    }
  }

  if (application.resumeFileName?.trim()) {
    return application.resumeFileName.trim();
  }

  return getResumeDocxFileName(profile);
}
