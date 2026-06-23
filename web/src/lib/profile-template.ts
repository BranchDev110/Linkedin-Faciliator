import { apiRequest } from './api';
import { Profile } from '../types';

export interface UploadProfileResumeTemplateInput {
  format: 'text' | 'docx';
  template?: string;
  templateDocxBase64?: string;
  fileName?: string;
}

export async function uploadProfileResumeTemplate(
  token: string,
  input: UploadProfileResumeTemplateInput,
): Promise<Profile> {
  const body =
    input.format === 'docx'
      ? {
          format: 'docx' as const,
          templateDocxBase64: input.templateDocxBase64,
          fileName: input.fileName,
        }
      : {
          format: 'text' as const,
          template: input.template,
          fileName: input.fileName,
        };

  return apiRequest<Profile>('/profiles/me/resume-template', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  });
}

export function profileHasResumeTemplate(profile: Profile | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  const format = profile.resumeTemplateFormat;
  if (format === 'docx') {
    return Boolean(profile.resumeTemplateFilePath?.trim());
  }

  if (format === 'text') {
    return Boolean(profile.resumeTemplate?.trim());
  }

  if (profile.resumeTemplateFilePath?.trim()) {
    return true;
  }

  return Boolean(profile.resumeTemplate?.trim());
}
