import { fetchCompanyApplyUrlViaVoyager } from './linkedin-voyager';
import {
  getCachedCompanyApplyUrl,
  setCachedCompanyApplyUrl,
} from './linkedin-voyager-cache';

export type ExtractJobOptions = {
  /** Passive monitoring uses hook cache only; explicit extract may fetch Voyager. */
  allowVoyagerFetch?: boolean;
};

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
  applyMethod?: JobApplyMethod;
}

export type JobApplyMethod = 'easy' | 'offsite' | 'unknown';

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

const LEGACY_JOB_DETAIL_ROOT_SELECTORS = [
  '.jobs-details__main-content',
  '.jobs-search__job-details--container',
  '.jobs-search__job-details',
  '.job-view-layout',
  '.scaffold-layout__detail',
  '[data-test-job-details]',
];

const LEGACY_UNIFIED_TOP_CARD_SELECTORS = {
  title: [
    '.job-details-jobs-unified-top-card__job-title h1 a',
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title h1 a',
    '.jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__sticky-header h2',
  ],
  company: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name a',
    'a[data-view-name="job-details-about-company-name-link"]',
    '.jobs-company .artdeco-entity-lockup__title a',
  ],
  location: [
    '.job-details-jobs-unified-top-card__tertiary-description-container',
    '.jobs-unified-top-card__tertiary-description-container',
    '.job-details-jobs-unified-top-card__primary-description-container',
    '.jobs-unified-top-card__primary-description',
  ],
  description: [
    '#job-details',
    '.jobs-description__content',
    '.jobs-box__html-content',
    'article.jobs-description__container',
    '.jobs-description',
    '.jobs-description-content__text--stretch',
    '.jobs-description-content__text',
    '.description__text',
  ],
};

function isLocationMetaNoise(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('ago') ||
    lower.includes('clicked') ||
    lower.includes('promoted') ||
    lower.includes('applicant') ||
    lower.includes('response') ||
    lower.includes('insights') ||
    lower.includes('hirer') ||
    lower.includes('easy apply')
  );
}

function queryDeepTextFromSelectors(
  selectors: string[],
  root: Document | Element = document,
): string {
  for (const selector of selectors) {
    const text = cleanText(queryDeepText(selector, root));
    if (text) return text;
  }
  return '';
}

function getLegacyJobDetailsRoot(): Element | null {
  for (const selector of LEGACY_JOB_DETAIL_ROOT_SELECTORS) {
    const el = queryDeep(selector);
    if (el) return el;
  }

  const topCardContainer = queryDeep('.job-details-jobs-unified-top-card__container');
  if (topCardContainer) {
    return (
      topCardContainer.closest('.jobs-details__main-content') ||
      topCardContainer.closest('.jobs-search__job-details') ||
      topCardContainer.closest('.jobs-details') ||
      topCardContainer.parentElement
    );
  }

  return null;
}

function getJobDetailsRoot(): Element {
  const sduiRoot =
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) ||
    queryDeep('[componentkey^="JobDetails_"]')?.closest('[data-sdui-screen]') ||
    queryDeep(ABOUT_THE_JOB_SELECTOR)?.closest('[data-sdui-screen]');
  if (sduiRoot) return sduiRoot;

  const legacyRoot = getLegacyJobDetailsRoot();
  if (legacyRoot) return legacyRoot;

  return document.body;
}

function extractJobId(root: Document | Element = document): string | null {
  const fromParam = new URL(window.location.href).searchParams.get('currentJobId');
  if (fromParam) return fromParam;

  const viewMatch = window.location.pathname.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch) return viewMatch[1];

  const detailLinkSelectors = [
    '.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/"]',
    '.jobs-search__job-details a[href*="/jobs/view/"]',
    '.jobs-details__main-content a[href*="/jobs/view/"]',
  ];
  for (const selector of detailLinkSelectors) {
    const link = queryDeep(selector, root) as HTMLAnchorElement | null;
    const linkMatch = link?.href?.match(/\/jobs\/view\/(\d+)/);
    if (linkMatch) return linkMatch[1];
  }

  const activeCard =
    queryDeep('.jobs-search-results-list__list-item--active [data-job-id]') ||
    queryDeep('.job-card-container[aria-current="page"][data-job-id]');
  const activeJobId = activeCard?.getAttribute('data-job-id')?.trim();
  if (activeJobId && /^\d+$/.test(activeJobId)) return activeJobId;

  const applyButton = queryDeep('[data-job-id]', root);
  const fromDataAttr = applyButton?.getAttribute('data-job-id')?.trim();
  if (fromDataAttr && /^\d+$/.test(fromDataAttr)) return fromDataAttr;

  const jobLink = queryDeep('a[href*="/jobs/view/"]', root) as HTMLAnchorElement | null;
  const linkMatch = jobLink?.href?.match(/\/jobs\/view\/(\d+)/);
  return linkMatch?.[1] || null;
}

export function extractLinkedInJobId(): string | null {
  return extractJobId();
}

function extractJobUrl(root: Document | Element = document): string {
  const jobId = extractJobId(root);
  if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  return window.location.href.split('?')[0];
}

export function tryExpandJobDescription(root: Document | Element = document): void {
  const expandSelectors = [
    '.jobs-description__footer-button',
    '[data-tracking-control-name="public_jobs_show-more-html-btn"]',
    '.jobs-description-content__text button',
    '.feed-shared-inline-show-more-text__see-more-less-toggle',
    '.inline-show-more-text__button',
  ];

  for (const selector of expandSelectors) {
    const el = queryDeep(selector, root);
    if (!(el instanceof HTMLElement)) continue;

    const label = (el.getAttribute('aria-label') || el.textContent || '').toLowerCase();
    if (label.includes('show less')) continue;

    el.click();
    return;
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

export function decodeLinkedInSafetyUrl(href: string): string {
  if (!href) return '';

  try {
    const url = new URL(href, window.location.origin);

    if (!url.hostname.includes('linkedin.com')) {
      return isExternalJobUrl(href) ? href : '';
    }

    if (
      url.pathname.includes('/safety/go') ||
      url.pathname.includes('/externalApply') ||
      url.pathname.includes('/redir/redirect')
    ) {
      const encodedTarget = url.searchParams.get('url');
      if (encodedTarget) {
        return decodeURIComponent(encodedTarget);
      }
    }

    return '';
  } catch {
    return '';
  }
}

type LinkedInJobView = 'sdui' | 'legacy';

/** View 1: React SDUI split-pane job details (SemanticJobDetails). */
const SDUI_REAL_JOB_URL_SELECTORS = [
  'a[aria-label*="Apply on company website"][href*="/safety/go"]',
  'a[href*="/safety/go"][aria-label*="Apply on company"]',
  '[componentkey^="JobDetails_"] a[href*="/safety/go"]',
  `a[href*="/safety/go"]`,
];

/** View 2: Legacy Ember single-pane / jobs-search detail panel. */
const LEGACY_REAL_JOB_URL_SELECTORS = [
  '.jobs-apply-button--top-card a[href]',
  'a.jobs-apply-button[href]',
  '.jobs-s-apply a[href]',
  'a[data-control-name="jobdetails_topcard_inapply"]',
  'a[href*="/externalApply"]',
  'a[href*="/safety/go"]',
  'a[data-tracking-control-name*="apply-link-offsite"]',
];

const LEGACY_OFFSITE_APPLY_BUTTON_SELECTORS = [
  'button.jobs-apply-button[data-live-test-job-apply-button]',
  'button.jobs-apply-button[aria-label*="company website"]',
  'button.jobs-apply-button[role="link"]',
];

function detectJobView(): LinkedInJobView {
  if (
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) ||
    queryDeep(ABOUT_THE_JOB_SELECTOR) ||
    queryDeep('[componentkey^="JobDetails_AboutTheJob_"]') ||
    queryDeep('[componentkey^="JobDetails_"]')
  ) {
    return 'sdui';
  }

  return 'legacy';
}

function getSduiJobDetailsRoot(): Element {
  return (
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) ||
    queryDeep('[componentkey^="JobDetails_"]')?.closest('[data-sdui-screen]') ||
    queryDeep(ABOUT_THE_JOB_SELECTOR)?.closest('[data-sdui-screen]') ||
    document.body
  );
}

function isEasyApplyControl(el: Element): boolean {
  const label = (
    el.getAttribute('aria-label') ||
    el.textContent ||
    ''
  ).toLowerCase();

  return label.includes('easy apply');
}

function isExternalApplyControl(el: Element): boolean {
  const label = (
    el.getAttribute('aria-label') ||
    el.textContent ||
    ''
  ).toLowerCase();

  if (isEasyApplyControl(el)) return false;
  if (label.includes('apply on company')) return true;
  if (label.includes('on company website')) return true;
  if (label === 'apply' || label.startsWith('apply ')) return true;

  const href = hrefFromElement(el).toLowerCase();
  return (
    href.includes('/safety/go') ||
    href.includes('/externalapply') ||
    href.includes('apply-link-offsite')
  );
}

function hrefFromElement(el: Element): string {
  if (el instanceof HTMLAnchorElement) {
    return el.href || el.getAttribute('href') || '';
  }

  for (const attr of ['data-url', 'data-href', 'data-job-url', 'data-apply-url']) {
    const value = el.getAttribute(attr);
    if (value) return value;
  }

  const anchor = el.closest('a[href]') as HTMLAnchorElement | null;
  if (anchor) {
    return anchor.href || anchor.getAttribute('href') || '';
  }

  return el.getAttribute('href') || '';
}

function parseApplyUrlFromText(text: string): string {
  if (!text) return '';

  const linkedInWrapped = text.match(
    /(?:safety\/go\/?\?url=|externalApply\/\d+\?url=)([^&"'\s<>]+)/i,
  );
  if (linkedInWrapped?.[1]) {
    const wrapped = `https://www.linkedin.com/safety/go?url=${linkedInWrapped[1]}`;
    const decoded = tryDecodeExternalJobUrl(wrapped);
    if (decoded) return decoded;
  }

  const jsonMatch = text.match(
    /"(?:companyApplyUrl|applyUrl|externalApplyUrl)"\s*:\s*"([^"]+)"/i,
  );
  if (jsonMatch?.[1]) {
    const decoded =
      tryDecodeExternalJobUrl(jsonMatch[1]) ||
      tryDecodeExternalJobUrl(decodeURIComponent(jsonMatch[1]));
    if (decoded) return decoded;
  }

  return '';
}

function extractApplyUrlFromHiddenCode(root: Element): string {
  for (const selector of ['#applyUrl', 'code#applyUrl', 'code[id="applyUrl"]']) {
    const codeEl = queryDeep(selector, root);
    if (!codeEl) continue;

    const fromCode = parseApplyUrlFromText(
      codeEl.textContent || (codeEl as HTMLElement).innerHTML || '',
    );
    if (fromCode) return fromCode;
  }

  return '';
}

function scanDocumentForEmbeddedApplyUrl(root: Element): string {
  const fromHiddenCode = extractApplyUrlFromHiddenCode(root);
  if (fromHiddenCode) return fromHiddenCode;

  for (const code of root.querySelectorAll('code')) {
    const fromCode = parseApplyUrlFromText(code.textContent || '');
    if (fromCode) return fromCode;
  }

  for (const script of root.querySelectorAll('script')) {
    const fromScript = parseApplyUrlFromText(script.textContent || '');
    if (fromScript) return fromScript;
  }

  return '';
}

function findLegacyOffsiteApplyButton(root: Element): Element | null {
  for (const selector of LEGACY_OFFSITE_APPLY_BUTTON_SELECTORS) {
    const button = queryDeep(selector, root);
    if (button && isExternalApplyControl(button)) return button;
  }

  return null;
}

function hasLegacyOffsiteApplyUi(root: Element): boolean {
  return (
    findLegacyOffsiteApplyButton(root) !== null ||
    queryDeep('.jobs-offsite-apply-confirmation-banner', root) !== null
  );
}

export function detectApplyMethod(root: Document | Element = document): JobApplyMethod {
  const legacyRoot = getLegacyJobDetailsRoot();
  if (legacyRoot && hasLegacyOffsiteApplyUi(legacyRoot)) {
    return 'offsite';
  }

  if (queryDeep('.jobs-offsite-apply-confirmation-banner', root)) {
    return 'offsite';
  }

  const easyApplySelectors = [
    'button[aria-label*="Easy Apply"]',
    'a[aria-label*="Easy Apply"]',
    '.jobs-apply-button[aria-label*="Easy Apply"]',
    'button.jobs-apply-button[aria-label*="Easy Apply"]',
  ];
  for (const selector of easyApplySelectors) {
    if (queryDeep(selector, root)) return 'easy';
  }

  const sduiRoot =
    queryDeep(`[data-sdui-screen="${JOB_DETAILS_SCREEN}"]`) ||
    queryDeep('[componentkey^="JobDetails_"]');
  if (sduiRoot) {
    if (queryDeep('a[aria-label*="Apply on company website"]', sduiRoot)) {
      return 'offsite';
    }
    if (queryDeep('a[aria-label*="Easy Apply"], button[aria-label*="Easy Apply"]', sduiRoot)) {
      return 'easy';
    }
  }

  if (findLegacyOffsiteApplyButton(document.body)) {
    return 'offsite';
  }

  return 'unknown';
}

async function fetchRealJobUrlFromExternalApply(jobId: string): Promise<string> {
  const endpoint = `https://www.linkedin.com/jobs/view/externalApply/${jobId}`;

  try {
    const manualResponse = await fetch(endpoint, {
      credentials: 'include',
      redirect: 'manual',
    });

    const location = manualResponse.headers.get('Location') || manualResponse.headers.get('location');
    if (location) {
      const decoded =
        tryDecodeExternalJobUrl(location) ||
        (isExternalJobUrl(location) ? location : '');
      if (decoded) return decoded;
    }

    if (manualResponse.type === 'opaqueredirect') {
      // Browser may hide redirect target — fall through to follow mode.
    } else if (manualResponse.ok) {
      const html = await manualResponse.text();
      const fromHtml = parseApplyUrlFromText(html);
      if (fromHtml) return fromHtml;
    }
  } catch {
    // fall through
  }

  try {
    const response = await fetch(endpoint, {
      credentials: 'include',
      redirect: 'follow',
    });

    if (response.url) {
      const decoded = tryDecodeExternalJobUrl(response.url);
      if (decoded) return decoded;
      if (isExternalJobUrl(response.url)) return response.url;
    }

    if (response.ok) {
      const html = await response.text();
      const fromHtml = parseApplyUrlFromText(html);
      if (fromHtml) return fromHtml;
    }
  } catch {
    return '';
  }

  return '';
}

function tryDecodeExternalJobUrl(href: string): string {
  const decoded = decodeLinkedInSafetyUrl(href);
  if (decoded && isExternalJobUrl(decoded)) return decoded;
  return '';
}

function collectRealJobUrlCandidates(
  root: Element,
  selectors: readonly string[],
): Element[] {
  const seen = new Set<Element>();
  const links: Element[] = [];

  for (const selector of selectors) {
    for (const el of queryDeepAll(selector, root)) {
      if (seen.has(el)) continue;
      seen.add(el);
      links.push(el);
    }
  }

  return links;
}

function extractRealJobUrlFromSelectors(
  root: Element,
  selectors: readonly string[],
  options: { requireExternalApply?: boolean } = {},
): string {
  for (const link of collectRealJobUrlCandidates(root, selectors)) {
    if (isEasyApplyControl(link)) continue;
    if (options.requireExternalApply && !isExternalApplyControl(link)) continue;

    const decoded = tryDecodeExternalJobUrl(hrefFromElement(link));
    if (decoded) return decoded;
  }

  return '';
}

/** View 1 — Apply link lives in SDUI/shadow DOM with linkedin.com/safety/go?url=… */
function extractRealJobUrlSdui(): string {
  const sduiRoot = getSduiJobDetailsRoot();

  const fromApplyButton = extractRealJobUrlFromSelectors(
    sduiRoot,
    SDUI_REAL_JOB_URL_SELECTORS.slice(0, 3),
    { requireExternalApply: true },
  );
  if (fromApplyButton) return fromApplyButton;

  const fromSduiRoot = extractRealJobUrlFromSelectors(
    sduiRoot,
    SDUI_REAL_JOB_URL_SELECTORS,
  );
  if (fromSduiRoot) return fromSduiRoot;

  return extractRealJobUrlFromSelectors(document.body, SDUI_REAL_JOB_URL_SELECTORS, {
    requireExternalApply: true,
  });
}

/** View 2 — Apply may be a button (no href) or an anchor in the Ember top card. */
async function extractRealJobUrlLegacy(jobId: string | null): Promise<string> {
  const legacyRoot = getLegacyJobDetailsRoot() || document.body;
  const topCard =
    queryDeep('.job-details-jobs-unified-top-card__container') ||
    queryDeep('.jobs-search__job-details--container') ||
    legacyRoot;

  const fromEmbedded = scanDocumentForEmbeddedApplyUrl(topCard);
  if (fromEmbedded) return fromEmbedded;

  const fromTopCard = extractRealJobUrlFromSelectors(
    topCard,
    LEGACY_REAL_JOB_URL_SELECTORS,
  );
  if (fromTopCard) return fromTopCard;

  const fromLegacyRoot = extractRealJobUrlFromSelectors(
    legacyRoot,
    LEGACY_REAL_JOB_URL_SELECTORS,
  );
  if (fromLegacyRoot) return fromLegacyRoot;

  return extractRealJobUrlFromSelectors(
    document.body,
    LEGACY_REAL_JOB_URL_SELECTORS,
  );
}

async function extractRealJobUrl(
  root: Element,
  jobId: string | null,
  options: ExtractJobOptions = {},
): Promise<string> {
  const allowFetch = options.allowVoyagerFetch !== false;
  let url = '';

  const legacyRoot = getLegacyJobDetailsRoot();
  if (legacyRoot && hasLegacyOffsiteApplyUi(legacyRoot)) {
    url = await extractRealJobUrlLegacy(jobId);
  } else if (detectJobView() === 'sdui') {
    url = extractRealJobUrlSdui();
  } else {
    url = await extractRealJobUrlLegacy(jobId);
  }

  if (!url && jobId) {
    url = getCachedCompanyApplyUrl(jobId);
  }

  if (!url && jobId && allowFetch) {
    url = await fetchCompanyApplyUrlViaVoyager(jobId, { allowFetch: true });
  }

  if (!url && jobId && allowFetch) {
    const topCard =
      queryDeep('.job-details-jobs-unified-top-card__container') ||
      queryDeep('.jobs-search__job-details--container') ||
      legacyRoot ||
      root;
    if (hasLegacyOffsiteApplyUi(topCard)) {
      url = await fetchRealJobUrlFromExternalApply(jobId);
      if (url) setCachedCompanyApplyUrl(jobId, url);
    }
  }

  return url;
}

function extractJobTitle(root: Element): string {
  const unifiedTitle = queryDeepTextFromSelectors(
    LEGACY_UNIFIED_TOP_CARD_SELECTORS.title,
    root,
  );
  if (unifiedTitle.length > 2 && unifiedTitle.length < 250) return unifiedTitle;

  const titleSelectors = [
    '[componentkey^="JobDetails_"] a[href*="/jobs/view/"]',
    'a[href*="/jobs/view/"]',
  ];

  for (const selector of titleSelectors) {
    const link = root.querySelector(selector);
    const title = cleanText(link?.textContent || '');
    if (title.length > 2 && title.length < 250) return title;
  }

  const legacyTitle =
    queryDeepText('[data-test-job-details-header] h1', root) ||
    queryDeepText('h1', root);

  return cleanText(legacyTitle);
}

function extractCompanyName(root: Element): string {
  const unifiedCompany = queryDeepTextFromSelectors(
    LEGACY_UNIFIED_TOP_CARD_SELECTORS.company,
    root,
  );
  if (unifiedCompany) return unifiedCompany;

  const ariaCompany = root.querySelector('[aria-label^="Company,"]');
  if (ariaCompany) {
    const match = ariaCompany.getAttribute('aria-label')?.match(/Company,\s*(.+?)\.?$/);
    if (match?.[1]) return cleanText(match[1]);
  }

  const logoLink = root.querySelector('a[aria-label$=" logo"]');
  if (logoLink) {
    const fromAria = logoLink.getAttribute('aria-label')?.replace(/\s+logo$/i, '').trim();
    if (fromAria) return cleanText(fromAria);
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
      !lower.includes('life/') &&
      !lower.includes('insights')
    ) {
      return name;
    }
  }

  return cleanText(queryDeepText('.topcard__org-name-link', root));
}

function extractCompanyLogoUrl(root: Element): string {
  const topCardLogo = queryDeep(
    '.job-details-jobs-unified-top-card__container img[src*="licdn.com"]',
    root,
  ) as HTMLImageElement | null;
  if (topCardLogo?.src?.startsWith('http')) return topCardLogo.src;

  const logoImages = root.querySelectorAll(
    'img[alt*="Company logo for"], img[alt$=" logo"], img[alt*="company logo"]',
  );
  for (const img of logoImages) {
    const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '';
    if (src.startsWith('http')) return src;
  }

  const companyBlock = root.querySelector('[aria-label^="Company,"]');
  if (companyBlock) {
    const img = companyBlock.querySelector('img[src*="licdn.com"]') as HTMLImageElement | null;
    if (img?.src?.startsWith('http')) return img.src;
  }

  const aboutCompanyImg = queryDeep(
    '.jobs-company img[src*="licdn.com"]',
    root,
  ) as HTMLImageElement | null;
  if (aboutCompanyImg?.src?.startsWith('http')) return aboutCompanyImg.src;

  const svg =
    companyBlock?.querySelector('svg') ||
    root.querySelector('figure svg[id*="company-accent"]');
  if (svg) {
    const svgString = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
  }

  return '';
}

function extractWorkTypePreferences(root: Element): string[] {
  const container = queryDeep('.job-details-fit-level-preferences', root);
  if (!container) return [];

  return Array.from(
    container.querySelectorAll('button .tvm__text strong, button strong'),
  )
    .map((el) => cleanText(el.textContent || ''))
    .filter(Boolean);
}

function extractLocation(root: Element): string {
  for (const selector of LEGACY_UNIFIED_TOP_CARD_SELECTORS.location) {
    const container = queryDeep(selector, root);
    if (!container) continue;

    const emphasisSpans = container.querySelectorAll('.tvm__text--low-emphasis');
    for (const span of emphasisSpans) {
      const candidate = cleanText(span.textContent || '');
      if (!candidate || isLocationMetaNoise(candidate)) continue;

      const workTypes = extractWorkTypePreferences(root);
      if (workTypes.length) {
        return `${candidate} · ${workTypes.join(' · ')}`;
      }
      return candidate;
    }

    const legacyText = cleanText(getDeepText(container));
    const firstSegment = cleanText(legacyText.split('·')[0] || legacyText);
    if (firstSegment && !isLocationMetaNoise(firstSegment)) {
      const workTypes = extractWorkTypePreferences(root);
      if (workTypes.length) {
        return `${firstSegment} · ${workTypes.join(' · ')}`;
      }
      return firstSegment;
    }
  }

  const metaParagraphs = root.querySelectorAll('p');
  for (const p of metaParagraphs) {
    const text = p.textContent || '';
    if (!text.includes('·')) continue;

    const firstSpan = p.querySelector('span');
    const candidate = cleanText(firstSpan?.textContent || '');
    if (!candidate || isLocationMetaNoise(candidate)) continue;

    return candidate;
  }

  return '';
}

function extractJobDescription(root: Document | Element = document): string {
  const aboutJob =
    queryDeep(ABOUT_THE_JOB_SELECTOR, root) ||
    queryDeep('[componentkey^="JobDetails_AboutTheJob_"] [data-sdui-component*="aboutTheJob"]', root) ||
    queryDeep('[data-sdui-component*="aboutTheJob"]', root);

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
    ...LEGACY_UNIFIED_TOP_CARD_SELECTORS.description,
  ];

  for (const selector of fallbackSelectors) {
    const el = queryDeep(selector, root);
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
    queryDeep('.job-details-jobs-unified-top-card') !== null ||
    queryDeep('.jobs-details__main-content') !== null ||
    queryDeep('.jobs-search__job-details') !== null ||
    queryDeep('#job-details') !== null ||
    queryDeep('[data-job-id]') !== null
  );
}

export async function extractJob(options: ExtractJobOptions = {}): Promise<ExtractedJob | null> {
  if (!isJobPage()) return null;

  const root = getJobDetailsRoot();
  tryExpandJobDescription(root);

  const jobTitle = extractJobTitle(root);
  const companyName = extractCompanyName(root);
  const location = extractLocation(root);
  const companyLogoUrl = extractCompanyLogoUrl(root);
  const jobDescription = extractJobDescription(root);

  if (!jobTitle && !companyName && !jobDescription) return null;

  const hardSkills = extractSkillsFromText(jobDescription);
  const competencies = extractSkillsFromText(
    jobDescription.replace(/technical|hard/gi, 'competency'),
  ).filter((s) => !hardSkills.includes(s));
  const linkedInJobUrl = extractJobUrl(root);
  const linkedInJobId = extractJobId(root) || undefined;
  const applyMethod = detectApplyMethod(root);
  const realJobUrl = await extractRealJobUrl(
    root,
    linkedInJobId || extractJobId(root),
    options,
  );

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
    applyMethod,
  };
}
