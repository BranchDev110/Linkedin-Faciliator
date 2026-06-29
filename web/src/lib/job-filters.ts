import { isSameLocalDay } from './application-filters';
import { applicationHasResume, applicationIsApplied } from './application-lookup';
import { Application } from '../types';

export type JobStatusFilter =
  | 'all'
  | 'no_activity'
  | 'skills_extracted'
  | 'resume_generated'
  | 'applied';

export type JobUserStatus = Exclude<JobStatusFilter, 'all'>;

export function getJobUserStatus(
  application: Application | null | undefined,
): JobUserStatus {
  if (!application) return 'no_activity';
  if (applicationIsApplied(application)) return 'applied';
  if (applicationHasResume(application)) return 'resume_generated';
  return 'skills_extracted';
}

export function jobStatusFilterLabel(filter: JobStatusFilter): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'no_activity':
      return 'No activity';
    case 'skills_extracted':
      return 'Skills extracted';
    case 'resume_generated':
      return 'Resume generated';
    case 'applied':
      return 'Applied';
  }
}

export function jobUserStatusLabel(status: JobUserStatus): string {
  return jobStatusFilterLabel(status);
}

export function matchesJobStatusFilter(
  userStatus: JobUserStatus,
  filter: JobStatusFilter,
): boolean {
  if (filter === 'all') return true;
  return userStatus === filter;
}

export function matchesJobDateFilter(
  recordedAt: string | undefined,
  dateValue: string,
): boolean {
  if (!dateValue) return true;
  if (!recordedAt) return false;
  return isSameLocalDay(recordedAt, dateValue);
}

export function jobUserStatusBadgeClass(status: JobUserStatus): string {
  switch (status) {
    case 'applied':
      return 'badge-success';
    case 'resume_generated':
      return 'badge-warning';
    case 'skills_extracted':
      return 'badge-info';
    case 'no_activity':
      return 'badge-neutral';
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
