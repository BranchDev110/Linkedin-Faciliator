export type ApplicationStatus = 'recorded' | 'applied';

export function normalizeApplicationStatus(status?: string): ApplicationStatus {
  if (status === 'applied') return 'applied';
  return 'recorded';
}
