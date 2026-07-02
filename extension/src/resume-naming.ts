interface ResumeProfileNaming {
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

export function getResumeDownloadFileName(
  profile: ResumeProfileNaming | null | undefined,
): string {
  if (!profile) {
    return 'resume.docx';
  }

  return getResumeDocxFileName(profile);
}

export function buildResumeDownloadPath(
  profile: ResumeProfileNaming | null | undefined,
  resumeFolderName?: string,
  resumeFileName?: string,
): string {
  if (!profile) {
    return resumeFileName?.trim() || 'resume.docx';
  }

  return getResumeDownloadPath(profile, resumeFolderName, resumeFileName);
}
