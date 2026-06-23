import { Application } from '../types';

export type ApplicationStatus = Application['status'];

export function normalizeApplicationStatus(
  status: ApplicationStatus | string | undefined,
): ApplicationStatus {
  if (status === 'applied') return 'applied';
  if (status === 'resume_generated') return 'resume_generated';
  if (status === 'extracted') return 'extracted';
  return 'recorded';
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (normalizeApplicationStatus(status)) {
    case 'applied':
      return 'Applied';
    case 'resume_generated':
      return 'Resume generated';
    case 'extracted':
      return 'Skills extracted';
    default:
      return 'Recorded';
  }
}

export function applicationStatusClass(status: ApplicationStatus): string {
  switch (normalizeApplicationStatus(status)) {
    case 'applied':
      return 'badge-success';
    case 'resume_generated':
      return 'badge-warning';
    case 'extracted':
      return 'badge-info';
    default:
      return 'badge-neutral';
  }
}

export function isAppliedStatus(status: ApplicationStatus | string | undefined): boolean {
  return normalizeApplicationStatus(status) === 'applied';
}
