export type ApplicationDateField = 'recorded' | 'applied';

function startOfLocalDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

export function isSameLocalDay(left?: string, rightDay?: string): boolean {
  if (!left || !rightDay) return false;

  const leftDay = startOfLocalDay(new Date(left));
  const targetDay = startOfLocalDay(new Date(`${rightDay}T00:00:00`));
  return leftDay === targetDay;
}

export function matchesApplicationDateFilter(
  createdAt: string,
  appliedAt: string | undefined,
  dateValue: string,
  field: ApplicationDateField,
): boolean {
  if (!dateValue) return true;

  if (field === 'recorded') {
    return isSameLocalDay(createdAt, dateValue);
  }

  return isSameLocalDay(appliedAt, dateValue);
}
