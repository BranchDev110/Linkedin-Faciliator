import { isSameLocalDay } from './application-filters';
import { applicationHasResume, applicationIsApplied } from './application-lookup';
import { Application, JobRecord } from '../types';

export type JobStatusFilter =
  | 'all'
  | 'jd_recorded_only'
  | 'skills_extracted'
  | 'resume_generated'
  | 'applied';

export type JobDisplayStatus = Exclude<JobStatusFilter, 'all'>;

export function jobHasExtractedSkills(
  job: Pick<JobRecord, 'hasSkills' | 'hardSkills' | 'competencies' | 'skills'>,
): boolean {
  if (typeof job.hasSkills === 'boolean') {
    return job.hasSkills;
  }

  if (job.hardSkills?.length || job.competencies?.length) {
    return true;
  }

  const skills = job.skills;
  return Boolean(
    skills?.hardSkills?.trim() ||
      skills?.competencies?.trim() ||
      skills?.role?.trim() ||
      skills?.title?.trim(),
  );
}

export function jobHasRecordedJd(
  job: Pick<JobRecord, 'hasJobDescription' | 'jobDescription'>,
): boolean {
  if (typeof job.hasJobDescription === 'boolean') {
    return job.hasJobDescription;
  }

  return Boolean(job.jobDescription?.trim());
}

function applicationHasExtractedSkills(
  application: Application | null | undefined,
): boolean {
  if (!application) return false;
  if (application.status === 'extracted') return true;

  const skills = application.skills;
  return Boolean(
    skills?.hardSkills?.trim() ||
      skills?.competencies?.trim() ||
      skills?.role?.trim() ||
      skills?.title?.trim() ||
      application.hardSkills?.length ||
      application.competencies?.length,
  );
}

export function getJobDisplayStatus(
  job: JobRecord,
  application: Application | null | undefined,
): JobDisplayStatus {
  if (application) {
    if (applicationIsApplied(application)) return 'applied';
    if (applicationHasResume(application)) return 'resume_generated';
    if (jobHasExtractedSkills(job) || applicationHasExtractedSkills(application)) {
      return 'skills_extracted';
    }
  }

  if (jobHasExtractedSkills(job)) {
    return 'skills_extracted';
  }

  return 'jd_recorded_only';
}

export function jobStatusFilterLabel(filter: JobStatusFilter): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'jd_recorded_only':
      return 'JD recorded only';
    case 'skills_extracted':
      return 'Skills extracted';
    case 'resume_generated':
      return 'Resume generated';
    case 'applied':
      return 'Applied';
  }
}

export function jobDisplayStatusLabel(status: JobDisplayStatus): string {
  return jobStatusFilterLabel(status);
}

export function matchesJobStatusFilter(
  displayStatus: JobDisplayStatus,
  filter: JobStatusFilter,
): boolean {
  if (filter === 'all') return true;
  return displayStatus === filter;
}

export function matchesJobDateFilter(
  recordedAt: string | undefined,
  dateValue: string,
): boolean {
  if (!dateValue) return true;
  if (!recordedAt) return false;
  return isSameLocalDay(recordedAt, dateValue);
}

export function jobDisplayStatusBadgeClass(status: JobDisplayStatus): string {
  switch (status) {
    case 'applied':
      return 'badge-success';
    case 'resume_generated':
      return 'badge-warning';
    case 'skills_extracted':
      return 'badge-info';
    case 'jd_recorded_only':
      return 'badge-secondary';
  }
}

export function sortJobsByRecordedAt<T extends { createdAt: string }>(
  jobs: T[],
  direction: 'asc' | 'desc' = 'desc',
): T[] {
  const sorted = [...jobs].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  return direction === 'asc' ? sorted : sorted.reverse();
}

export function jobCanExtractSkills(job: JobRecord): boolean {
  return !jobHasExtractedSkills(job) && jobHasRecordedJd(job);
}
