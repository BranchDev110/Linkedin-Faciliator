import { Application } from '../types';
import { extractRealJdSite } from './real-jd-site';

export type ApplicationSortField =
  | 'companyName'
  | 'status'
  | 'realJdSite'
  | 'recordedAt';

export type SortDirection = 'asc' | 'desc';

function normalizeStatus(status: Application['status'] | string): Application['status'] {
  return status === 'applied' ? 'applied' : 'recorded';
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

export function sortApplications(
  applications: Application[],
  field: ApplicationSortField,
  direction: SortDirection,
): Application[] {
  const sorted = [...applications];

  sorted.sort((left, right) => {
    switch (field) {
      case 'companyName':
        return compareStrings(left.companyName, right.companyName, direction);
      case 'status': {
        const leftStatus = normalizeStatus(left.status);
        const rightStatus = normalizeStatus(right.status);
        return compareStrings(leftStatus, rightStatus, direction);
      }
      case 'realJdSite': {
        const leftSite = extractRealJdSite(left.realJobUrl) || 'zzz';
        const rightSite = extractRealJdSite(right.realJobUrl) || 'zzz';
        return compareStrings(leftSite, rightSite, direction);
      }
      case 'recordedAt': {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return direction === 'asc' ? leftTime - rightTime : rightTime - leftTime;
      }
      default:
        return 0;
    }
  });

  return sorted;
}

export function sortFieldLabel(field: ApplicationSortField): string {
  switch (field) {
    case 'companyName':
      return 'Company';
    case 'status':
      return 'Status';
    case 'realJdSite':
      return 'Real JD site';
    case 'recordedAt':
      return 'Recorded date';
    default:
      return field;
  }
}
