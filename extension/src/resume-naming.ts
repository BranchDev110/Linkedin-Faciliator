interface ResumeProfileNaming {
  profileName: string;
  firstName?: string;
  lastName?: string;
}

export const LIF_DOWNLOAD_ROOT = 'Lif';

function sanitizeResumeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Resume';
}

function sanitizePathSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_+/g, '_')
      .replace(/^[\s._]+|[\s._]+$/g, '') || 'Unknown'
  );
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

export function formatResumeDownloadDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildLifJobFolderName(company: string, role: string): string {
  return [
    sanitizePathSegment(company || 'Company'),
    sanitizePathSegment(role || 'Role'),
  ].join('_');
}

export function buildLifProfileFolderName(profile: ResumeProfileNaming): string {
  return sanitizePathSegment(getCandidateDisplayName(profile));
}

export function buildLifResumeRelativeFolder(
  profile: ResumeProfileNaming,
  company: string,
  role: string,
  date = new Date(),
): string {
  return [
    buildLifProfileFolderName(profile),
    formatResumeDownloadDate(date),
    buildLifJobFolderName(company, role),
  ].join('/');
}

export function buildLifResumeDownloadPath(
  profile: ResumeProfileNaming,
  company: string,
  role: string,
  resumeFileName?: string,
  date = new Date(),
): string {
  const fileName = resumeFileName?.trim() || getResumeDocxFileName(profile);
  const relativeFolder = buildLifResumeRelativeFolder(profile, company, role, date);
  return `${LIF_DOWNLOAD_ROOT}/${relativeFolder}/${fileName}`;
}

export function getResumeDownloadPath(
  profile: ResumeProfileNaming,
  resumeFolderName?: string,
  resumeFileName?: string,
): string {
  const fileName = resumeFileName?.trim() || getResumeDocxFileName(profile);
  if (resumeFolderName?.trim()) {
    const folder = resumeFolderName.trim().replace(/^[/\\]+/, '');
    if (folder === LIF_DOWNLOAD_ROOT || folder.startsWith(`${LIF_DOWNLOAD_ROOT}/`)) {
      return `${folder}/${fileName}`;
    }
    return `${LIF_DOWNLOAD_ROOT}/${folder}/${fileName}`;
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

export function buildResumeDownloadPathForJob(
  profile: ResumeProfileNaming | null | undefined,
  company: string,
  role: string,
  resumeFileName?: string,
  date = new Date(),
): string {
  if (!profile) {
    const fallbackProfile = { profileName: 'Resume' };
    const relativeFolder = buildLifResumeRelativeFolder(
      fallbackProfile,
      company,
      role,
      date,
    );
    const fileName = resumeFileName?.trim() || 'resume.docx';
    return `${LIF_DOWNLOAD_ROOT}/${relativeFolder}/${fileName}`;
  }

  return buildLifResumeDownloadPath(profile, company, role, resumeFileName, date);
}
