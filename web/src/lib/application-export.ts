import JSZip from 'jszip';
import {
  fetchAuthenticatedFile,
  fileNameFromDownloadUrl,
  filePathFromDownloadUrl,
} from './api';
import { extractRealJdSite, classifyJobSiteApplyMode } from './real-jd-site';
import { normalizeApplicationStatus } from './application-status';
import { applicationHasResume } from './application-lookup';
import { Application, Profile } from '../types';

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
  resumeUrl?: string;
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

function getResumeFolderName(resumeUrl?: string): string {
  if (!resumeUrl) return '';
  const fileName = fileNameFromDownloadUrl(resumeUrl);
  return fileName.replace(/\.docx$/i, '');
}

function buildExportItem(
  app: Application,
  profile: Profile | undefined,
): ExportApplicationItem {
  const profileName = profile?.profileName || 'Profile';
  const resumeFolderName = getResumeFolderName(app.resumeUrl);
  const realJobUrl = app.realJobUrl || '';

  return {
    id: app.id,
    userId: app.userId,
    profileId: app.profileId,
    profileName,
    companyName: app.companyName,
    jobTitle: app.jobTitle,
    jobDescription: app.jobDescription,
    linkedInJobUrl: app.linkedInJobUrl || '',
    realJobUrl,
    realJdSite: extractRealJdSite(realJobUrl),
    applyMode: classifyJobSiteApplyMode(realJobUrl),
    resumeFolderName,
    resumeFileName: resumeFolderName ? getProfileDocxFileName(profileName) : '',
    resumeUrl: app.resumeUrl,
    location: app.location,
    companyLogoUrl: app.companyLogoUrl,
    companyBullets: app.companyBullets,
    skills: app.skills,
    hardSkills: app.hardSkills,
    competencies: app.competencies,
    status: normalizeApplicationStatus(app.status),
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
  token: string,
): Promise<{ exportedCount: number; resumeCount: number }> {
  const exportableApplications = applications.filter((app) => applicationHasResume(app));

  if (exportableApplications.length === 0) {
    throw new Error('Select applications with generated resumes to export.');
  }

  if (exportableApplications.length !== applications.length) {
    throw new Error('Export only includes applications with generated resumes.');
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const zip = new JSZip();
  const exportItems: ExportApplicationItem[] = [];
  let resumeCount = 0;

  for (const app of exportableApplications) {
    const profile = profileById.get(app.profileId);
    const exportItem = buildExportItem(app, profile);
    exportItems.push(exportItem);

    const filePath = app.resumeUrl ? filePathFromDownloadUrl(app.resumeUrl) : '';
    if (!filePath || !exportItem.resumeFolderName) {
      continue;
    }

    const blob = await fetchAuthenticatedFile(filePath, token);
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
