export interface ProfileLike {
  resumeTemplate?: string;
  resumeTemplateFormat?: string;
  resumeTemplateFilePath?: string;
  resumeTemplateFileName?: string;
  companies?: unknown;
}

export type ApplicationNoticeKind = 'recorded' | 'resume_generated' | 'applied';

export function normalizeProfileCompanies(raw: unknown): { name: string }[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (!item || typeof item !== 'object') return null;
      const name = String((item as { name?: string }).name || '').trim();
      return name ? { name } : null;
    })
    .filter((item): item is { name: string } => item !== null);
}

export function profileHasTemplate(profile: ProfileLike | null | undefined): boolean {
  if (!profile) return false;

  const format = profile.resumeTemplateFormat;
  if (format === 'docx') {
    return Boolean(profile.resumeTemplateFilePath?.trim());
  }
  if (format === 'text') {
    return Boolean(profile.resumeTemplate?.trim());
  }

  if (profile.resumeTemplateFilePath?.trim()) return true;
  return Boolean(profile.resumeTemplate?.trim());
}

export function getProfileSetupWarnings(
  profile: ProfileLike | null | undefined,
): string[] {
  if (!profile) {
    return ['Profile not loaded. Sign in again if this persists.'];
  }

  const warnings: string[] = [];
  if (normalizeProfileCompanies(profile.companies).length === 0) {
    warnings.push('Add companies in the dashboard before generating resumes.');
  }
  if (!profileHasTemplate(profile)) {
    warnings.push('Upload a resume template in the dashboard before generating resumes.');
  }
  return warnings;
}

export function resolveApplicationNotice(application: {
  id?: string;
  status?: string;
  resumeUrl?: string;
}): ApplicationNoticeKind | null {
  if (application.status === 'applied') {
    return 'applied';
  }
  if (application.resumeUrl?.trim() || application.status === 'resume_generated') {
    return 'resume_generated';
  }
  if (application.id) {
    return 'recorded';
  }
  return null;
}

export function applicationNoticeMessage(kind: ApplicationNoticeKind): string {
  switch (kind) {
    case 'applied':
      return 'You already applied to this job. It is recorded in Applications.';
    case 'resume_generated':
      return 'Resume already generated for this job. It is recorded in Applications.';
    default:
      return 'This job is already recorded in Applications.';
  }
}

export function applicationBlocksResumeGeneration(application: {
  status?: string;
  resumeUrl?: string;
} | null | undefined): boolean {
  if (!application) return false;
  if (application.status === 'applied') return true;
  return Boolean(application.resumeUrl?.trim()) || application.status === 'resume_generated';
}
