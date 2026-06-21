import { Profile, ProfileCompany } from './dto/profile.dto';

function normalizeTemplateFormat(
  value: unknown,
  data: Record<string, unknown>,
): Profile['resumeTemplateFormat'] {
  if (value === 'docx' || value === 'text') return value;
  if (
    String(data.resumeTemplateFilePath || data.resumeTemplateDriveFileId || '').trim()
  ) {
    return 'docx';
  }
  if (String(data.resumeTemplate || '').trim()) return 'text';
  return '';
}

function parseBulletCount(value: unknown): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 1;
}

export function normalizeCompanies(raw: unknown): ProfileCompany[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): ProfileCompany | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        if (!name) return null;
        return { name, prompt: '', bulletCount: 1 };
      }

      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;
      const name = String(record.name || '').trim();
      if (!name) return null;

      return {
        name,
        prompt: String(record.prompt || record.companyPrompt || ''),
        bulletCount: parseBulletCount(record.bulletCount),
      };
    })
    .filter((item): item is ProfileCompany => item !== null);
}

export function normalizeProfile(
  id: string,
  data: Record<string, unknown>,
): Profile {
  return {
    id,
    userId: String(data.userId || ''),
    profileName: String(data.profileName || ''),
    firstName: String(data.firstName || ''),
    lastName: String(data.lastName || ''),
    email: String(data.email || ''),
    phoneNumber: String(data.phoneNumber || ''),
    linkedin: String(data.linkedin || ''),
    generalPrompt: String(data.generalPrompt || data.resumePrompt || ''),
    companies: normalizeCompanies(data.companies),
    resumeTemplate: String(data.resumeTemplate || ''),
    resumeTemplateFileName: String(data.resumeTemplateFileName || ''),
    resumeTemplateFormat: normalizeTemplateFormat(
      data.resumeTemplateFormat,
      data,
    ),
    resumeTemplateFilePath: String(
      data.resumeTemplateFilePath || data.resumeTemplateDriveFileId || '',
    ),
    address: {
      city: String((data.address as Profile['address'])?.city || ''),
      state: String((data.address as Profile['address'])?.state || ''),
    },
  };
}

export function serializeCompanies(companies: unknown): ProfileCompany[] {
  return normalizeCompanies(companies).map((company) => ({
    name: company.name,
    prompt: company.prompt || '',
    bulletCount: company.bulletCount || 1,
  }));
}
