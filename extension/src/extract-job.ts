export interface ExtractedJob {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  hardSkills: string[];
  competencies: string[];
  location: string;
  jobUrl: string;
  linkedInJobUrl: string;
  linkedInJobId?: string;
  realJobUrl?: string;
  companyLogoUrl?: string;
}

export const ABOUT_THE_JOB_COMPONENT =
  'com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob';

const JOB_DETAILS_SCREEN =
  'com.linkedin.sdui.flagshipnav.jobs.SemanticJobDetails';

const ABOUT_THE_JOB_SELECTOR = `[data-sdui-component="${ABOUT_THE_JOB_COMPONENT}"]`;

function walkShadowRoots<T extends Element>(
  root: Document | Element | ShadowRoot,
  visit: (el: Element) => T | null,
): T | null {
  const elements =
    root instanceof Document
      ? Array.from(root.body?.querySelectorAll('*') || [])
      : root instanceof ShadowRoot
        ? Array.from(root.querySelectorAll('*'))
        : Array.from(root.querySelectorAll('*'));

  for (const el of elements) {
    const match = visit(el);
    if (match) return match;

    if (el.shadowRoot) {
      const shadowMatch = walkShadowRoots(el.shadowRoot, visit);
      if (shadowMatch) return shadowMatch;
    }
  }

  return null;
}

export function queryDeep(selector: string, root: Document | Element = document): Element | null {
  const direct = root.querySelector(selector);
  if (direct) return direct;

  return walkShadowRoots(root, (el) => {
    if (el.matches(selector)) return el;
    if (el.shadowRoot) {
      return el.shadowRoot.querySelector(selector);
    }
    return null;
  });
}

function getDeepText(el: Element): string {
  const parts: string[] = [];

  if (el.shadowRoot) {
    for (const child of Array.from(el.shadowRoot.childNodes)) {
      const text = getTextFromNode(child);
      if (text) parts.push(text);
    }
  }

  for (const child of Array.from(el.childNodes)) {
    const text = getTextFromNode(child);
    if (text) parts.push(text);
  }

  if (parts.length) {
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  return (el.textContent || (el as HTMLElement).innerText || '').trim();
}

function getTextFromNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    if (el.shadowRoot) return getDeepText(el);

    const blockTags = new Set([
      'P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BR', 'SECTION', 'UL',
    ]);
    if (blockTags.has(el.tagName)) {
      const inner = getDeepText(el);
      return inner ? `${inner}\n` : '';
    }

    return getDeepText(el);
  }

  return '';
}

export function queryDeepText(selector: string, root: Document | Element = document): string {
  const el = queryDeep(selector, root);
  return el ? getDeepText(el) : '';
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanJobDescription(text: string): string {
  return text
    .replace(/^About the job\s*/i, '')
    .replace(/\s*…\s*more\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getJobDetailsRoot(): Element {
  return (
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) ||
    queryDeep('[componentkey^="JobDetails_"]')?.closest('[data-sdui-screen]') ||
    queryDeep(ABOUT_THE_JOB_SELECTOR)?.closest('[data-sdui-screen]') ||
    document.body
  );
}

function extractJobId(): string | null {
  const fromParam = new URL(window.location.href).searchParams.get('currentJobId');
  if (fromParam) return fromParam;

  const viewMatch = window.location.pathname.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch) return viewMatch[1];

  const jobLink = queryDeep('a[href*="/jobs/view/"]') as HTMLAnchorElement | null;
  const linkMatch = jobLink?.href?.match(/\/jobs\/view\/(\d+)/);
  return linkMatch?.[1] || null;
}

export function extractLinkedInJobId(): string | null {
  return extractJobId();
}

function extractJobUrl(): string {
  const jobId = extractJobId();
  if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  return window.location.href.split('?')[0];
}

export function decodeLinkedInSafetyUrl(href: string): string {
  if (!href) return '';

  try {
    const url = new URL(href, window.location.origin);
    if (!url.hostname.includes('linkedin.com')) return '';
    if (!url.pathname.includes('/safety/go')) return '';

    const encodedTarget = url.searchParams.get('url');
    if (!encodedTarget) return '';

    return decodeURIComponent(encodedTarget);
  } catch {
    return '';
  }
}

function isExternalJobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return !parsed.hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

function queryDeepAll(
  selector: string,
  root: Document | Element = document,
): Element[] {
  const results: Element[] = [];
  const seen = new Set<Element>();

  const add = (el: Element) => {
    if (!seen.has(el)) {
      seen.add(el);
      results.push(el);
    }
  };

  if (root instanceof Document) {
    root.querySelectorAll(selector).forEach(add);
  } else {
    if (root.matches(selector)) add(root);
    root.querySelectorAll(selector).forEach(add);
  }

  walkShadowRoots(root, (el) => {
    if (el.matches(selector)) add(el);
    if (el.shadowRoot) {
      el.shadowRoot.querySelectorAll(selector).forEach(add);
    }
    return null;
  });

  return results;
}

function extractRealJobUrl(root: Element): string {
  const selectors = [
    'a[href*="/safety/go"]',
    'a[href*="linkedin.com/safety/go"]',
  ];

  for (const selector of selectors) {
    for (const link of queryDeepAll(selector, root)) {
      const href =
        (link as HTMLAnchorElement).href || link.getAttribute('href') || '';
      const decoded = decodeLinkedInSafetyUrl(href);
      if (decoded && isExternalJobUrl(decoded)) {
        return decoded;
      }
    }
  }

  return '';
}

function extractJobTitle(root: Element): string {
  const titleSelectors = [
    'a[href*="/jobs/view/"]',
    '[componentkey^="JobDetails_"] a[href*="/jobs/view/"]',
  ];

  for (const selector of titleSelectors) {
    const link = root.querySelector(selector);
    const title = cleanText(link?.textContent || '');
    if (title.length > 2 && title.length < 250) return title;
  }

  const legacyTitle =
    queryDeepText('.job-details-jobs-unified-top-card__job-title h1', root) ||
    queryDeepText('.jobs-unified-top-card__job-title h1', root) ||
    queryDeepText('[data-test-job-details-header] h1', root) ||
    queryDeepText('h1', root);

  return cleanText(legacyTitle);
}

function extractCompanyName(root: Element): string {
  const ariaCompany = root.querySelector('[aria-label^="Company,"]');
  if (ariaCompany) {
    const match = ariaCompany.getAttribute('aria-label')?.match(/Company,\s*(.+?)\.?$/);
    if (match?.[1]) return cleanText(match[1]);
  }

  const companyLinks = root.querySelectorAll('a[href*="/company/"]');
  for (const link of companyLinks) {
    const href = link.getAttribute('href') || '';
    if (!href.includes('/company/')) continue;

    const name = cleanText(link.textContent || '');
    const lower = name.toLowerCase();
    if (
      name &&
      name.length < 100 &&
      !lower.includes('follow') &&
      !lower.includes('show more') &&
      !lower.includes('life/')
    ) {
      return name;
    }
  }

  const legacyCompany =
    queryDeepText('.job-details-jobs-unified-top-card__company-name a', root) ||
    queryDeepText('.jobs-unified-top-card__company-name a', root) ||
    queryDeepText('.topcard__org-name-link', root);

  return cleanText(legacyCompany);
}

function extractCompanyLogoUrl(root: Element): string {
  const logoImages = root.querySelectorAll('img[alt*="Company logo for"]');
  for (const img of logoImages) {
    const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '';
    if (src.startsWith('http')) return src;
  }

  const companyBlock = root.querySelector('[aria-label^="Company,"]');
  if (companyBlock) {
    const img = companyBlock.querySelector('img[src*="licdn.com"]') as HTMLImageElement | null;
    if (img?.src?.startsWith('http')) return img.src;
  }

  const svg =
    companyBlock?.querySelector('svg') ||
    root.querySelector('figure svg[id*="company-accent"]');
  if (svg) {
    const svgString = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
  }

  return '';
}

function extractLocation(root: Element): string {
  const metaParagraphs = root.querySelectorAll('p');
  for (const p of metaParagraphs) {
    const text = p.textContent || '';
    if (!text.includes('·')) continue;

    const firstSpan = p.querySelector('span');
    const candidate = cleanText(firstSpan?.textContent || '');
    if (!candidate) continue;

    const lower = candidate.toLowerCase();
    if (
      lower.includes('ago') ||
      lower.includes('clicked') ||
      lower.includes('promoted') ||
      lower.includes('applicant') ||
      lower.includes('response')
    ) {
      continue;
    }

    return candidate;
  }

  const legacyLocation =
    queryDeepText('.job-details-jobs-unified-top-card__primary-description-container', root) ||
    queryDeepText('.jobs-unified-top-card__primary-description', root);

  return cleanText(legacyLocation.split('·')[0] || legacyLocation);
}

function extractJobDescription(): string {
  const aboutJob =
    queryDeep(ABOUT_THE_JOB_SELECTOR) ||
    queryDeep('[componentkey^="JobDetails_AboutTheJob_"] [data-sdui-component*="aboutTheJob"]') ||
    queryDeep('[data-sdui-component*="aboutTheJob"]');

  if (aboutJob) {
    const expandable = aboutJob.querySelector('[data-testid="expandable-text-box"]');
    if (expandable) {
      const text = cleanJobDescription(getDeepText(expandable));
      if (text.length > 50) return text;
    }

    const paragraphs = aboutJob.querySelectorAll('p');
    for (const p of paragraphs) {
      const text = cleanJobDescription(getDeepText(p));
      if (text.length > 100) return text;
    }

    const sectionText = cleanJobDescription(getDeepText(aboutJob));
    if (sectionText.length > 50) return sectionText;
  }

  const fallbackSelectors = [
    '[data-testid="expandable-text-box"]',
    '.jobs-description__content',
    '.jobs-box__html-content',
    '#job-details',
    '.description__text',
    '.jobs-description-content__text',
  ];

  for (const selector of fallbackSelectors) {
    const el = queryDeep(selector);
    const text = el ? cleanJobDescription(getDeepText(el)) : '';
    if (text.length > 50) return text;
  }

  return '';
}

function extractSkillsFromText(text: string): string[] {
  const skills = new Set<string>();
  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'Angular',
    'Vue', 'SQL', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker',
    'Kubernetes', 'Git', 'CI/CD', 'Agile', 'Scrum', 'REST', 'GraphQL',
    'HTML', 'CSS', 'C++', 'C#', '.NET', 'Go', 'Rust', 'Ruby', 'PHP',
    'Machine Learning', 'Data Analysis', 'Project Management', 'Leadership',
    'Communication', 'Problem Solving', 'Team Collaboration', 'Excel',
    'Power BI', 'Tableau', 'Figma', 'Jira', 'Confluence', 'Terraform',
    'Linux', 'Redis', 'Elasticsearch', 'Kafka', 'Spark', 'Hadoop',
    'Spring', 'Django', 'Flask', 'FastAPI', 'NestJS', 'Next.js',
  ];

  for (const skill of commonSkills) {
    const regex = new RegExp(`\\b${skill.replace(/[.+*?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) skills.add(skill);
  }

  const skillPatterns = [
    /(?:required|must have|proficien\w+ in|experience with|knowledge of)\s*:?\s*([^.!?\n]+)/gi,
    /(?:skills?|technologies?|tools?)\s*:?\s*([^.!?\n]+)/gi,
  ];

  for (const pattern of skillPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      match[1]
        .split(/[,;|•·]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 50)
        .forEach((s) => skills.add(s));
    }
  }

  return Array.from(skills).slice(0, 20);
}

function isJobPage(): boolean {
  const href = window.location.href;
  const onJobUrl =
    href.includes('/jobs/view/') ||
    href.includes('/jobs/collections/') ||
    href.includes('/jobs/search-results/') ||
    href.includes('currentJobId=') ||
    /\/jobs\/[^/?#]+/.test(href);

  return (
    onJobUrl ||
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) !== null ||
    queryDeep(ABOUT_THE_JOB_SELECTOR) !== null ||
    queryDeep('[componentkey^="JobDetails_AboutTheJob_"]') !== null ||
    queryDeep('.jobs-unified-top-card') !== null ||
    queryDeep('.job-details-jobs-unified-top-card') !== null
  );
}

export function extractJob(): ExtractedJob | null {
  if (!isJobPage()) return null;

  const root = getJobDetailsRoot();
  const jobTitle = extractJobTitle(root);
  const companyName = extractCompanyName(root);
  const location = extractLocation(root);
  const companyLogoUrl = extractCompanyLogoUrl(root);
  const jobDescription = extractJobDescription();

  if (!jobTitle && !companyName && !jobDescription) return null;

  const hardSkills = extractSkillsFromText(jobDescription);
  const competencies = extractSkillsFromText(
    jobDescription.replace(/technical|hard/gi, 'competency'),
  ).filter((s) => !hardSkills.includes(s));
  const linkedInJobUrl = extractJobUrl();
  const linkedInJobId = extractJobId() || undefined;
  const realJobUrl = extractRealJobUrl(root);

  return {
    companyName: companyName || 'Unknown Company',
    jobTitle: jobTitle || 'Unknown Position',
    jobDescription: jobDescription || '',
    hardSkills,
    competencies: competencies.slice(0, 10),
    location,
    jobUrl: linkedInJobUrl,
    linkedInJobUrl,
    linkedInJobId,
    realJobUrl: realJobUrl || undefined,
    companyLogoUrl: companyLogoUrl || undefined,
  };
}
