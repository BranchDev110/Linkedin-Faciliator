function normalizeUrlKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function urlsLikelyMatch(pageUrl: string, candidateUrl: string): boolean {
  const pageKey = normalizeUrlKey(pageUrl);
  const candidateKey = normalizeUrlKey(candidateUrl);
  if (!pageKey || !candidateKey) return false;

  if (pageKey === candidateKey) return true;
  if (pageKey.startsWith(candidateKey) || candidateKey.startsWith(pageKey)) {
    return true;
  }

  const pageHost = pageKey.split('/')[0];
  const candidateHost = candidateKey.split('/')[0];
  return pageHost === candidateHost && pageHost.length > 0;
}
