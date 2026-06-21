const ATS_SITES: { id: string; label: string; pattern: RegExp }[] = [
  { id: 'greenhouse', label: 'Greenhouse', pattern: /greenhouse\.io/i },
  { id: 'lever', label: 'Lever', pattern: /lever\.co/i },
  { id: 'ashby', label: 'Ashby', pattern: /ashbyhq\.com/i },
  { id: 'workable', label: 'Workable', pattern: /workable\.com/i },
  { id: 'workday', label: 'Workday', pattern: /myworkdayjobs\.com/i },
  { id: 'icims', label: 'iCIMS', pattern: /icims\.com/i },
  { id: 'jobvite', label: 'Jobvite', pattern: /jobvite\.com/i },
  { id: 'smartrecruiters', label: 'SmartRecruiters', pattern: /smartrecruiters\.com/i },
  { id: 'taleo', label: 'Taleo', pattern: /taleo\.net/i },
  { id: 'successfactors', label: 'SuccessFactors', pattern: /successfactors\.com/i },
  { id: 'phenom', label: 'Phenom', pattern: /phenompeople\.com|phenom\.com/i },
  { id: 'bamboohr', label: 'BambooHR', pattern: /bamboohr\.com/i },
  { id: 'rippling', label: 'Rippling', pattern: /rippling\.com/i },
  { id: 'oracle', label: 'Oracle', pattern: /oraclecloud\.com/i },
  { id: 'ultipro', label: 'UltiPro', pattern: /ultipro\.com/i },
  { id: 'paylocity', pattern: /paylocity\.com/i, label: 'Paylocity' },
  { id: 'eightfold', label: 'Eightfold', pattern: /eightfold\.ai/i },
];

const AUTOBID_PATTERNS = [/greenhouse\.io/i, /myworkdayjobs\.com/i];
const EXTENSION_PATTERNS = [/ashbyhq\.com/i, /lever\.co/i, /workable\.com/i];

export type JobSiteApplyMode = 'autobid' | 'extension' | 'other';

export function extractRealJdSite(url?: string): string {
  if (!url?.trim()) return '';

  for (const site of ATS_SITES) {
    if (site.pattern.test(url)) {
      return site.label;
    }
  }

  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function classifyJobSiteApplyMode(realJobUrl?: string): JobSiteApplyMode {
  const url = realJobUrl?.trim() || '';
  if (!url) return 'other';
  if (AUTOBID_PATTERNS.some((pattern) => pattern.test(url))) return 'autobid';
  if (EXTENSION_PATTERNS.some((pattern) => pattern.test(url))) return 'extension';
  return 'other';
}

export function jobSiteApplyModeLabel(mode: JobSiteApplyMode): string {
  switch (mode) {
    case 'autobid':
      return 'Autobid';
    case 'extension':
      return 'Extension';
    default:
      return 'Other';
  }
}

export function listKnownRealJdSites(): string[] {
  return ATS_SITES.map((site) => site.label);
}
