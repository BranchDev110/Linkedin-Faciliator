export interface ResumeProfileNaming {
  profileName: string;
  firstName?: string;
  lastName?: string;
}

function sanitizeResumeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Resume';
}

export function getCandidateDisplayName(profile: ResumeProfileNaming): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return fullName || profile.profileName.trim() || 'Resume';
}

export function getResumeDocxFileName(profile: ResumeProfileNaming): string {
  return `${sanitizeResumeFileName(getCandidateDisplayName(profile))}.docx`;
}

export function getResumeTextFileName(profile: ResumeProfileNaming): string {
  return `${sanitizeResumeFileName(getCandidateDisplayName(profile))}.txt`;
}

export function isResumeFileName(fileName: string): boolean {
  return /\.(docx|pdf|doc|rtf)$/i.test(fileName.trim());
}

export function normalizeResumeFolderName(folderName: string): string | null {
  const trimmed = folderName.trim();
  if (!/^Resume_/i.test(trimmed)) {
    return null;
  }

  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
}

export function parseResumeFolderFromSelection(input: {
  value?: string;
  webkitRelativePath?: string;
  fileName?: string;
}): { resumeFolderName: string; resumeFileName: string } | null {
  const fileName = input.fileName?.trim() || '';
  if (!fileName || !isResumeFileName(fileName)) {
    return null;
  }

  const relativePath = input.webkitRelativePath?.trim();
  if (relativePath) {
    const parts = relativePath.split(/[/\\]/).filter(Boolean);
    if (parts.length >= 2) {
      const folderName = normalizeResumeFolderName(parts[parts.length - 2]);
      if (folderName) {
        return { resumeFolderName: folderName, resumeFileName: parts[parts.length - 1] };
      }
    }
  }

  const value = input.value?.trim() || '';
  if (value) {
    const segments = value.split(/[/\\]/).filter(Boolean);
    const folderIndex = segments.findIndex((segment) => /^Resume_/i.test(segment));
    if (folderIndex >= 0) {
      const folderName = normalizeResumeFolderName(segments[folderIndex]);
      if (folderName) {
        return {
          resumeFolderName: folderName,
          resumeFileName: segments[segments.length - 1] || fileName,
        };
      }
    }
  }

  return { resumeFolderName: '', resumeFileName: fileName };
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

export function filePathFromDownloadUrl(downloadUrl: string): string {
  const trimmed = downloadUrl.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/files\/(.+)$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Fall through for relative paths.
  }

  const relativeMatch = trimmed.match(/(resumes\/[^?#]+)/i);
  if (relativeMatch?.[1]) {
    return decodeURIComponent(relativeMatch[1]);
  }

  return '';
}

export function resolveApplicationResumeFolder(input: {
  id?: string;
  resumeUrl?: string;
  resumeFolderName?: string;
}): string {
  const resumeUrl = input.resumeUrl?.trim();
  if (resumeUrl) {
    const parsed = parseResumeStoragePath(filePathFromDownloadUrl(resumeUrl));
    if (parsed?.resumeFolderName) {
      return parsed.resumeFolderName;
    }
  }

  if (input.id?.trim()) {
    return computeResumeStorageFolder(input.id);
  }

  return input.resumeFolderName?.trim() || '';
}

export function resolveApplicationResumeFileName(input: {
  resumeUrl?: string;
  resumeFileName?: string;
}): string {
  const resumeUrl = input.resumeUrl?.trim();
  if (resumeUrl) {
    const parsed = parseResumeStoragePath(filePathFromDownloadUrl(resumeUrl));
    if (parsed?.resumeFileName) {
      return parsed.resumeFileName;
    }
  }

  return input.resumeFileName?.trim() || '';
}

export function getResumeDownloadPath(
  profile: ResumeProfileNaming,
  resumeFolderName?: string,
  resumeFileName?: string,
): string {
  const fileName = resumeFileName?.trim() || getResumeDocxFileName(profile);
  if (resumeFolderName?.trim()) {
    return `${resumeFolderName.trim()}/${fileName}`;
  }

  return fileName;
}
