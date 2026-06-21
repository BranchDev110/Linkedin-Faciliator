import JSZip from 'jszip';
import { fetchAuthenticatedFile } from './api';
import { extractRealJdSite, classifyJobSiteApplyMode } from './real-jd-site';
import { Application, Profile, Resume } from '../types';

export interface ExportApplicationItem {
  id: string;
  userId: string;
  profileId: string;
  profileName: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  linkedInJobUrl: string;
  realJobUrl: string;
  realJdSite: string;
  applyMode: 'autobid' | 'extension' | 'other';
  resumeFolderName: string;
  resumeFileName: string;
  resumeId?: string;
  location?: string;
  companyLogoUrl?: string;
  companyBullets?: { company: string; bullets: string }[];
  skills?: Application['skills'];
  hardSkills: string[];
  competencies: string[];
  status: Application['status'];
  aiCostUsd?: number;
  aiCostBreakdown?: Application['aiCostBreakdown'];
  createdAt: string;
  appliedAt?: string;
  updatedAt: string;
}

function sanitizeFileStem(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Profile';
}

export function getProfileDocxFileName(profileName: string): string {
  return `${sanitizeFileStem(profileName)}.docx`;
}

export function getResumeFolderName(resume?: Resume): string {
  if (!resume) return '';
  if (resume.fileName) {
    return resume.fileName.replace(/\.docx$/i, '');
  }
  return resume.id;
}

function buildExportItem(
  app: Application,
  profile: Profile | undefined,
  resume: Resume | undefined,
): ExportApplicationItem {
  const profileName = profile?.profileName || 'Profile';
  const resumeFolderName = getResumeFolderName(resume);
  const realJobUrl = app.realJobUrl || '';

  return {
    id: app.id,
    userId: app.userId,
    profileId: app.profileId,
    profileName,
    companyName: app.companyName,
    jobTitle: app.jobTitle,
    jobDescription: app.jobDescription,
    linkedInJobUrl: app.linkedInJobUrl || app.jobUrl || '',
    realJobUrl,
    realJdSite: extractRealJdSite(realJobUrl),
    applyMode: classifyJobSiteApplyMode(realJobUrl),
    resumeFolderName,
    resumeFileName: resumeFolderName ? getProfileDocxFileName(profileName) : '',
    resumeId: app.resumeId,
    location: app.location,
    companyLogoUrl: app.companyLogoUrl,
    companyBullets: app.companyBullets,
    skills: app.skills,
    hardSkills: app.hardSkills,
    competencies: app.competencies,
    status: app.status === 'applied' ? 'applied' : 'recorded',
    aiCostUsd: app.aiCostUsd,
    aiCostBreakdown: app.aiCostBreakdown,
    createdAt: app.createdAt,
    appliedAt: app.appliedAt,
    updatedAt: app.updatedAt,
  };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportSelectedApplications(
  applications: Application[],
  profiles: Profile[],
  resumes: Resume[],
  token: string,
): Promise<{ exportedCount: number; resumeCount: number }> {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const resumeById = new Map(resumes.map((resume) => [resume.id, resume]));
  const zip = new JSZip();
  const exportItems: ExportApplicationItem[] = [];
  let resumeCount = 0;

  for (const app of applications) {
    const profile = profileById.get(app.profileId);
    const resume = app.resumeId ? resumeById.get(app.resumeId) : undefined;
    const exportItem = buildExportItem(app, profile, resume);
    exportItems.push(exportItem);

    if (!resume?.filePath || !exportItem.resumeFolderName) {
      continue;
    }

    const blob = await fetchAuthenticatedFile(resume.filePath, token);
    const folder = zip.folder(exportItem.resumeFolderName);
    if (!folder) continue;

    folder.file(exportItem.resumeFileName, blob);
    resumeCount += 1;
  }

  zip.file('applications.json', JSON.stringify(exportItems, null, 2));

  const archive = await zip.generateAsync({ type: 'blob' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(archive, `applications-export-${stamp}.zip`);

  return {
    exportedCount: exportItems.length,
    resumeCount,
  };
}
