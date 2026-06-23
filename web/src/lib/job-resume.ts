import { apiRequest } from './api';
import {
  normalizeApplicationResponse,
  resolveApplicationId,
  unwrapApplicationLookup,
} from './application-lookup';
import { profileHasResumeTemplate } from './profile-template';
import { Application, JobRecord, Profile } from '../types';

type ResumeSkills = NonNullable<Application['skills']>;

function joinSkillValues(values: string[]): string {
  return values.filter(Boolean).join(' & ');
}

export function jobSkillsForResume(job: JobRecord): ResumeSkills | null {
  const skills = job.skills;
  if (skills?.hardSkills || skills?.role || skills?.title) {
    return {
      role: skills.role || job.jobTitle || '',
      title: skills.title || job.jobTitle || '',
      title1: skills.title1 || '',
      title2: skills.title2 || '',
      title3: skills.title3 || '',
      title4: skills.title4 || '',
      companyName: skills.companyName || job.companyName || '',
      focus: skills.focus || '',
      hardSkills:
        skills.hardSkills ||
        joinSkillValues(job.hardSkills),
      additionalHardSkills: skills.additionalHardSkills || '',
      competencies:
        skills.competencies ||
        joinSkillValues(job.competencies),
    };
  }

  if (!job.hardSkills.length && !job.competencies.length) {
    return null;
  }

  return {
    role: job.jobTitle || '',
    title: job.jobTitle || '',
    title1: '',
    title2: '',
    title3: '',
    title4: '',
    companyName: job.companyName || '',
    focus: '',
    hardSkills: joinSkillValues(job.hardSkills),
    additionalHardSkills: '',
    competencies: joinSkillValues(job.competencies),
  };
}

export function applicationToJobRecord(app: Application): JobRecord {
  return {
    id: app.jobId || '',
    linkedInJobId: app.linkedInJobId || '',
    companyName: app.companyName,
    jobTitle: app.jobTitle,
    jobDescription: app.jobDescription,
    skills: app.skills,
    hardSkills: app.hardSkills,
    competencies: app.competencies,
    linkedInJobUrl: app.linkedInJobUrl || '',
    realJobUrl: app.realJobUrl || '',
    location: app.location || '',
    companyLogoUrl: app.companyLogoUrl || '',
    extractionCostUsd: 0,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export function applicationHasExtractedSkills(app: Application): boolean {
  return Boolean(jobSkillsForResume(applicationToJobRecord(app)));
}

export function getGenerateResumeDisabledReason(
  profile: Profile | null | undefined,
  options?: {
    profileLoading?: boolean;
    targetLabel?: string;
    hasSkills?: boolean;
    hasResume?: boolean;
    isApplied?: boolean;
    generating?: boolean;
  },
): string {
  const targetLabel = options?.targetLabel || 'This application';

  if (options?.profileLoading) return 'Loading profile...';
  if (!profile) return 'Profile not loaded.';
  if (options?.isApplied) return 'You already applied to this job.';
  if (options?.hasResume) return 'Resume already generated for this job.';
  if (!profileHasResumeTemplate(profile)) {
    return 'Upload a resume template in My Profile first.';
  }
  if (!profile.companies.length) {
    return 'Add companies to your profile first.';
  }
  if (options?.hasSkills === false) {
    return `${targetLabel} has no extracted skills yet.`;
  }
  if (options?.generating) return 'Generating resume...';
  return '';
}

export function getApplicationForJob(
  job: JobRecord,
  applications: Application[],
): Application | null {
  return (
    applications.find(
      (app) =>
        app.jobId === job.id ||
        (job.linkedInJobId && app.linkedInJobId === job.linkedInJobId),
    ) ?? null
  );
}

export async function lookupJobApplication(
  job: JobRecord,
  token: string,
  profileId?: string,
): Promise<Application | null> {
  const params = new URLSearchParams();
  if (job.id) params.set('jobId', job.id);
  if (job.linkedInJobId) params.set('linkedInJobId', job.linkedInJobId);
  if (profileId) params.set('profileId', profileId);

  const response = await apiRequest<unknown>(
    `/applications/lookup?${params.toString()}`,
    { token },
  );

  return unwrapApplicationLookup(response);
}

async function ensureJobApplication(
  job: JobRecord,
  token: string,
  skills: ResumeSkills,
  profileId?: string,
): Promise<Application> {
  const existing = await lookupJobApplication(job, token, profileId);
  const existingId = resolveApplicationId(existing);
  if (existing && existingId) {
    return { ...existing, id: existingId };
  }

  const created = await apiRequest<unknown>('/applications', {
    method: 'POST',
    token,
    body: JSON.stringify({
      profileId,
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      jobDescription: job.jobDescription,
      jobId: job.id,
      linkedInJobId: job.linkedInJobId,
      linkedInJobUrl: job.linkedInJobUrl,
      realJobUrl: job.realJobUrl,
      location: job.location,
      companyLogoUrl: job.companyLogoUrl,
      skills,
      skipSkillExtraction: true,
    }),
  });

  let application = normalizeApplicationResponse(created);
  if (!application) {
    application = await lookupJobApplication(job, token, profileId);
  }

  const applicationId = resolveApplicationId(application);
  if (!application || !applicationId) {
    throw new Error('Failed to create application record.');
  }

  return { ...application, id: applicationId };
}

export interface GenerateJobResumeResult {
  application: Application;
  fileUrl: string;
  fileName: string;
}

export async function generateResumeFromJob(
  job: JobRecord,
  profile: Profile,
  token: string,
  onProgress?: (message: string) => void,
): Promise<GenerateJobResumeResult> {
  const skills = jobSkillsForResume(job);
  if (!skills) {
    throw new Error('This job has no extracted skills yet.');
  }

  if (!profile.companies.length) {
    throw new Error('Add companies to your profile before generating a resume.');
  }

  if (!profileHasResumeTemplate(profile)) {
    throw new Error('Upload a resume template in your profile settings first.');
  }

  onProgress?.('Recording application...');
  const application = await ensureJobApplication(job, token, skills, profile.id);
  const applicationId = resolveApplicationId(application);
  if (!applicationId) {
    throw new Error('Application record is missing an ID.');
  }

  onProgress?.('Generating resume bullets...');
  const bulletsResponse = await apiRequest<{
    results: { company: string; bullets: string[] }[];
  }>('/resumes/generate-all-bullets', {
    method: 'POST',
    token,
    body: JSON.stringify({
      skills,
      companies: profile.companies.map((company) => ({
        companyName: company.name,
        bulletCount: company.bulletCount,
      })),
      jobDescription: job.jobDescription,
      targetJobCompany: job.companyName,
      targetJobTitle: job.jobTitle,
      applicationId,
    }),
  });

  const companyBullets = bulletsResponse.results.map((result) => ({
    company: result.company,
    bullets: result.bullets.filter(Boolean).join('\n'),
  }));

  if (!companyBullets.some((entry) => entry.bullets.trim())) {
    throw new Error('Resume bullets could not be generated.');
  }

  const updatedApplication = await apiRequest<unknown>(
    `/applications/${applicationId}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ companyBullets }),
    },
  );

  const patchedApplication = normalizeApplicationResponse(updatedApplication);
  if (!patchedApplication) {
    throw new Error('Failed to save generated resume bullets.');
  }

  onProgress?.('Generating resume...');
  const resume = await apiRequest<{
    fileUrl: string;
    fileName: string;
  }>('/resumes/generate', {
    method: 'POST',
    token,
    body: JSON.stringify({
      applicationId,
      skills,
      companyBullets,
    }),
  });

  const refreshed = await apiRequest<unknown>(`/applications/${applicationId}`, {
    token,
  });

  const finalApplication = normalizeApplicationResponse(refreshed);
  if (!finalApplication) {
    throw new Error('Failed to load the generated application.');
  }

  return {
    application: finalApplication,
    fileUrl: resume.fileUrl,
    fileName: resume.fileName,
  };
}

export async function generateResumeFromApplication(
  application: Application,
  profile: Profile,
  token: string,
  onProgress?: (message: string) => void,
): Promise<GenerateJobResumeResult> {
  return generateResumeFromJob(
    applicationToJobRecord(application),
    profile,
    token,
    onProgress,
  );
}

export async function recordSkillsExtractedForJob(
  job: JobRecord,
  token: string,
  profileId?: string,
): Promise<Application> {
  const response = await apiRequest<{
    application?: Application;
    applicationId?: string;
  }>('/applications/extract-skills', {
    method: 'POST',
    token,
    body: JSON.stringify({
      jobDescription: job.jobDescription,
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      linkedInJobId: job.linkedInJobId,
      linkedInJobUrl: job.linkedInJobUrl,
      realJobUrl: job.realJobUrl,
      location: job.location,
      companyLogoUrl: job.companyLogoUrl,
      profileId,
    }),
  });

  const application =
    normalizeApplicationResponse(response.application) ||
    (response.applicationId
      ? await lookupJobApplication(job, token, profileId)
      : null);

  if (!application) {
    throw new Error('Failed to record skills extraction.');
  }

  return application;
}

export async function loadUserProfile(token: string): Promise<Profile> {
  return apiRequest<Profile>('/profiles/me', { token });
}
