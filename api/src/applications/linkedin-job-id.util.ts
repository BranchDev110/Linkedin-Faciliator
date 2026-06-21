export function extractLinkedInJobIdFromUrl(url?: string): string {
  if (!url?.trim()) return '';

  try {
    const parsed = new URL(url);
    const fromParam = parsed.searchParams.get('currentJobId');
    if (fromParam) return fromParam;
  } catch {
    // Fall through to regex parsing.
  }

  const paramMatch = url.match(/[?&]currentJobId=(\d+)/i);
  if (paramMatch?.[1]) return paramMatch[1];

  const viewMatch = url.match(/\/jobs\/view\/(\d+)/i);
  return viewMatch?.[1] || '';
}

export function resolveLinkedInJobId(
  linkedInJobId?: string,
  linkedInJobUrl?: string,
  jobUrl?: string,
): string {
  return (
    linkedInJobId?.trim() ||
    extractLinkedInJobIdFromUrl(linkedInJobUrl) ||
    extractLinkedInJobIdFromUrl(jobUrl) ||
    ''
  );
}
