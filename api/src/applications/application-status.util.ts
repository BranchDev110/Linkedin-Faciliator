export type ApplicationStatus =
  | 'recorded'
  | 'extracted'
  | 'resume_generated'
  | 'applied';

export function normalizeApplicationStatus(status?: string): ApplicationStatus {
  if (status === 'applied') return 'applied';
  if (status === 'resume_generated') return 'resume_generated';
  if (status === 'extracted') return 'extracted';
  return 'recorded';
}

export function applicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
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
