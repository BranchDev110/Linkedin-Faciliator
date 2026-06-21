import {
  bindBulletTextarea,
  formatBulletLines,
  BULLET_LINE_PREFIX,
  resetBulletTextareaBaseline,
  stripBulletLinePrefix,
} from './bullet-format';
import {
  getStorage,
  setStorage,
  signOut,
  openAuthPage,
  openWebApp,
  apiRequest,
  ensureAuthenticatedSession,
  downloadAuthenticatedFile,
} from './shared';
import { formatUsd } from './format-cost';
import type { ExtractedJob } from './extract-job';

interface ProfileCompany {
  name: string;
  prompt: string;
  bulletCount: number;
}

interface Profile {
  id: string;
  profileName: string;
  firstName?: string;
  lastName?: string;
  generalPrompt?: string;
  resumeTemplate?: string;
  resumeTemplateFileName?: string;
  resumeTemplateFormat?: 'text' | 'docx' | '';
  resumeTemplateFilePath?: string;
  companies?: ProfileCompany[];
}

interface GenerateCompanyBulletsResponse {
  company: string;
  bullets: string[];
  costUsd?: number;
  applicationAiCostUsd?: number;
}

interface GenerateAllCompanyBulletsResponse {
  results: GenerateCompanyBulletsResponse[];
  costUsd?: number;
  applicationAiCostUsd?: number;
}

interface ApplicationSkills {
  role: string;
  title: string;
  title1: string;
  title2: string;
  title3: string;
  title4: string;
  companyName: string;
  focus: string;
  hardSkills: string;
  additionalHardSkills: string;
  competencies: string;
}

interface ExtractApplicationSkillsResponse {
  skills: ApplicationSkills;
  costUsd: number;
  fromCache?: boolean;
  applicationAiCostUsd?: number;
}

interface ApplicationAiCostBreakdown {
  skillExtraction?: number;
  resumeBullets?: number;
  resumeContent?: number;
}

interface StoredApplication {
  id: string;
  profileId?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  linkedInJobId?: string;
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  hardSkills: string[];
  competencies: string[];
  skills?: ApplicationSkills;
  companyBullets?: { company: string; bullets: string }[];
  aiCostUsd?: number;
  aiCostBreakdown?: ApplicationAiCostBreakdown;
  resumeId?: string;
  status?: 'recorded' | 'applied';
}

interface GeneratedResumeInfo {
  filePath?: string;
  fileName?: string;
  fileUrl?: string;
}

const authSection = document.getElementById('auth-section')!;
const mainSection = document.getElementById('main-section')!;
const userEmail = document.getElementById('user-email')!;
const userAvatar = document.getElementById('user-avatar')!;
const profileSelect = document.getElementById('profile-select') as HTMLSelectElement;
const profileApplicationNotice = document.getElementById('profile-application-notice')!;
const btnRefreshProfiles = document.getElementById('btn-refresh-profiles') as HTMLButtonElement;
const noJob = document.getElementById('no-job')!;
const jobPanel = document.getElementById('job-panel')!;
const jobTitle = document.getElementById('job-title')!;
const jobCompany = document.getElementById('job-company')!;
const companyAvatar = document.getElementById('company-avatar')!;
const jobSkills = document.getElementById('job-skills')!;
const jdText = document.getElementById('jd-text') as HTMLTextAreaElement;
const jdHighlight = document.getElementById('jd-highlight')!;
const skillsText = document.getElementById('skills-text') as HTMLTextAreaElement;
const btnRefreshJd = document.getElementById('btn-refresh-jd') as HTMLButtonElement;
const btnRefreshJdEmpty = document.getElementById('btn-refresh-jd-empty') as HTMLButtonElement;
const btnExtractSkills = document.getElementById('btn-extract-skills') as HTMLButtonElement;
const btnApplied = document.getElementById('btn-applied') as HTMLButtonElement;
const btnGenerate = document.getElementById('btn-generate') as HTMLButtonElement;
const btnOneClickDone = document.getElementById('btn-one-click-done') as HTMLButtonElement;
const companyBulletsSection = document.getElementById('company-bullets-section')!;
const companyBulletsList = document.getElementById('company-bullets-list')!;
const btnGenerateAllBullets = document.getElementById('btn-generate-all-bullets') as HTMLButtonElement;
const statusEl = document.getElementById('status')!;
const jobCostPanel = document.getElementById('job-cost-panel')!;
const jobCostSkillsEl = document.getElementById('job-cost-skills')!;
const jobCostBulletsEl = document.getElementById('job-cost-bullets')!;
const jobCostTotalEl = document.getElementById('job-cost-total')!;
const resumeResultEl = document.getElementById('resume-result')!;
const resumeResultNameEl = document.getElementById('resume-result-name')!;
const btnDownloadResume = document.getElementById('btn-download-resume') as HTMLButtonElement;
const dashboardLink = document.getElementById('dashboard-link') as HTMLAnchorElement;
const workflowOverlay = document.getElementById('workflow-overlay')!;
const workflowOverlayMessage = document.getElementById('workflow-overlay-message')!;

let currentJob: ExtractedJob | null = null;
let extractedSkills: ApplicationSkills | null = null;
let lastApplicationId: string | null = null;
let pendingSkillExtractionCostUsd = 0;
let jobCostBreakdown: ApplicationAiCostBreakdown = {};
let skillsLoadedFromCache = false;
let lastGeneratedResume: GeneratedResumeInfo | null = null;
let lastResumeId: string | null = null;
let applicationStatus: 'recorded' | 'applied' | null = null;
let skillsExtractedForDescription = '';
let skillsExtractedForJobId = '';
let profiles: Profile[] = [];
let lastAutoDetectedJobKey = '';
let oneClickInProgress = false;
let resumeInputSnapshot: string | null = null;
let skillsEditorBaseline = '';

const JD_LOCATION_PATTERNS = [/\bOnsite\b/gi, /\bOn\s*-?\s*Site\b/gi, /\bHybrid\b/gi];

function getJobDetectionKey(job: ExtractedJob): string {
  if (job.linkedInJobId?.trim()) return job.linkedInJobId.trim();
  return (
    job.linkedInJobUrl?.trim() ||
    job.jobUrl?.trim() ||
    `${job.jobTitle}|${job.companyName}`
  );
}

function buildCompanyLabelHtml(companyName: string): string {
  return escapeHtml(companyName);
}

function roundCostUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function getJobCostTotal(): number {
  return roundCostUsd(
    (jobCostBreakdown.skillExtraction ?? 0) +
      (jobCostBreakdown.resumeBullets ?? 0),
  );
}

function resetJobCosts() {
  jobCostBreakdown = {};
  skillsLoadedFromCache = false;
  updateJobCostPanel();
}

function applyCostBreakdownFromApplication(app: StoredApplication) {
  if (app.aiCostBreakdown) {
    jobCostBreakdown = { ...app.aiCostBreakdown };
  } else if (typeof app.aiCostUsd === 'number' && app.aiCostUsd > 0) {
    jobCostBreakdown = { skillExtraction: app.aiCostUsd };
  } else {
    jobCostBreakdown = {};
  }

  skillsLoadedFromCache =
    Boolean(app.skills) && (jobCostBreakdown.skillExtraction ?? 0) <= 0;
  updateJobCostPanel();
}

function addLocalCost(category: keyof ApplicationAiCostBreakdown, amount: number) {
  if (amount <= 0) return;
  jobCostBreakdown[category] = roundCostUsd((jobCostBreakdown[category] ?? 0) + amount);
  updateJobCostPanel();
}

async function refreshCostFromApplication(token: string): Promise<void> {
  if (!lastApplicationId) return;

  try {
    const app = await apiRequest<StoredApplication>(`/applications/${lastApplicationId}`, {
      token,
    });
    applyCostBreakdownFromApplication(app);
  } catch {
    // Keep local cost estimates when refresh fails.
  }
}

function updateJobCostPanel() {
  const skillCost = jobCostBreakdown.skillExtraction ?? 0;
  const bulletCost = jobCostBreakdown.resumeBullets ?? 0;
  const total = getJobCostTotal();

  if (
    skillsLoadedFromCache ||
    (skillCost <= 0 && hasSkillsContent(extractedSkills))
  ) {
    jobCostSkillsEl.textContent = `${formatUsd(0)} · saved`;
  } else {
    jobCostSkillsEl.textContent = formatUsd(skillCost);
  }

  jobCostBulletsEl.textContent = formatUsd(bulletCost);
  jobCostTotalEl.textContent = formatUsd(total);
  jobCostPanel.classList.remove('hidden');
}

function clearCompanyBulletFields() {
  renderCompanyBulletFields();
}

function hideResumeDownload() {
  resumeResultNameEl.textContent = '—';
}

function showResumeDownload(fileName: string) {
  resumeResultNameEl.textContent = fileName;
}

function buildResumeInputSnapshot(): string {
  return JSON.stringify({
    profileId: profileSelect.value,
    linkedInJobId: getCurrentLinkedInJobId(),
    skills: extractedSkills,
    companyBullets: collectAllCompanyBullets(),
  });
}

function commitResumeInputSnapshot(): void {
  resumeInputSnapshot = buildResumeInputSnapshot();
}

function markResumeInputsChanged(): void {
  resumeInputSnapshot = null;
}

function isResumeUpToDate(): boolean {
  if (!lastGeneratedResume?.filePath && !lastResumeId) {
    return false;
  }
  if (!resumeInputSnapshot) {
    return false;
  }
  return resumeInputSnapshot === buildResumeInputSnapshot();
}

function clearResumeState(): void {
  lastGeneratedResume = null;
  lastResumeId = null;
  resumeInputSnapshot = null;
  hideResumeDownload();
}

function invalidateGeneratedResume(): void {
  markResumeInputsChanged();
}

function resetWorkflowState() {
  resetApplicationPrefillState({ keepSkills: false });
}

function getCurrentLinkedInJobId(): string {
  return currentJob?.linkedInJobId?.trim() || '';
}

function clearApplicationNotice() {
  profileApplicationNotice.textContent = '';
  profileApplicationNotice.className = 'profile-application-notice hidden';
}

function showApplicationNotice(status: 'recorded' | 'applied') {
  profileApplicationNotice.textContent =
    status === 'applied'
      ? 'You already applied to this job with this profile.'
      : 'You already recorded this job with this profile.';
  profileApplicationNotice.className = `profile-application-notice notice-${status}`;
}

function resetApplicationPrefillState(options?: { keepSkills?: boolean }) {
  const keepSkills =
    options?.keepSkills ??
    Boolean(
      extractedSkills &&
        skillsExtractedForDescription &&
        skillsExtractedForDescription === jdText.value.trim(),
    );

  lastApplicationId = null;
  lastResumeId = null;
  applicationStatus = null;
  pendingSkillExtractionCostUsd = 0;
  clearResumeState();
  resetJobCosts();
  void chrome.storage.local.remove('lastApplicationId');
  clearApplicationNotice();

  if (!keepSkills) {
    clearSkillsField();
  }
}

function applySavedCompanyBullets(bullets: { company: string; bullets: string }[]) {
  const companies = getSelectedCompanies();

  bullets.forEach((entry) => {
    const index = companies.findIndex((company) => company.name === entry.company);
    if (index < 0 || !entry.bullets?.trim()) return;

    const textarea = companyBulletsList.querySelector<HTMLTextAreaElement>(
      `textarea[data-company-index="${index}"]`,
    );
    if (textarea) {
      textarea.value = entry.bullets;
      resetBulletTextareaBaseline(textarea);
      updateBulletHighlight(textarea);
    }
  });
}

async function applyApplicationPrefill(
  app: StoredApplication,
  token: string,
): Promise<void> {
  lastApplicationId = app.id;
  applicationStatus = app.status === 'applied' ? 'applied' : 'recorded';
  lastResumeId = app.resumeId || null;
  await setStorage({ lastApplicationId: app.id });

  if (app.skills) {
    displaySkillsJson(app.skills, { skipDirty: true });
    pendingSkillExtractionCostUsd = 0;
  }

  applyCostBreakdownFromApplication(app);
  renderCompanyBulletFields();

  if (app.companyBullets?.length) {
    applySavedCompanyBullets(app.companyBullets);
  }

  if (app.resumeId) {
    try {
      const resume = await apiRequest<GeneratedResumeInfo & { id: string }>(
        `/resumes/${app.resumeId}`,
        { token },
      );
      lastGeneratedResume = {
        filePath: resume.filePath,
        fileName: resume.fileName,
        fileUrl: resume.fileUrl,
      };
      if (resume.fileName || resume.filePath) {
        showResumeDownload(resume.fileName || 'Resume');
      }
      commitResumeInputSnapshot();
    } catch {
      clearResumeState();
    }
  } else {
    hideResumeDownload();
    markResumeInputsChanged();
  }

  updateAppliedButton();
  updateActionButtons();
}

async function syncCachedSkillsForCurrentJob(): Promise<void> {
  const linkedInJobId = getCurrentLinkedInJobId();
  if (!linkedInJobId) return;

  if (extractedSkills && skillsExtractedForJobId === linkedInJobId) {
    return;
  }

  const storage = await getStorage();
  if (!storage.token) return;

  try {
    const response = await apiRequest<{
      skills: ApplicationSkills;
      fromCache?: boolean;
    } | null>(
      `/applications/skills?linkedInJobId=${encodeURIComponent(linkedInJobId)}`,
      { token: storage.token },
    );

    if (response?.skills && hasSkillsContent(response.skills)) {
      skillsLoadedFromCache = true;
      displaySkillsJson(response.skills, { skipDirty: true });
      updateJobCostPanel();
      updateActionButtons();
    }
  } catch {
    // Cached skills unavailable.
  }
}

async function syncExistingApplicationForCurrentJob(): Promise<void> {
  const linkedInJobId = getCurrentLinkedInJobId();
  const profileId = profileSelect.value;

  if (!linkedInJobId) {
    resetApplicationPrefillState({ keepSkills: true });
    return;
  }

  if (!profileId) {
    lastApplicationId = null;
    applicationStatus = null;
    clearResumeState();
    resetJobCosts();
    clearApplicationNotice();
    void chrome.storage.local.remove('lastApplicationId');
    updateAppliedButton();
    updateActionButtons();
    return;
  }

  resetJobCosts();

  const storage = await getStorage();
  if (!storage.token) return;

  try {
    const application = await apiRequest<StoredApplication | null>(
      `/applications/lookup?linkedInJobId=${encodeURIComponent(linkedInJobId)}&profileId=${encodeURIComponent(profileId)}`,
      { token: storage.token },
    );

    if (application) {
      await applyApplicationPrefill(application, storage.token);
      showApplicationNotice(application.status === 'applied' ? 'applied' : 'recorded');
      return;
    }
  } catch {
    // Fall through to reset when lookup fails.
  }

  resetApplicationPrefillState({ keepSkills: true });
}

async function refreshJobSkillsAndApplication(): Promise<void> {
  await syncCachedSkillsForCurrentJob();
  await syncExistingApplicationForCurrentJob();
}

function canRecordApplication(): boolean {
  return (
    jdText.value.trim().length > 0 &&
    Boolean(profileSelect.value) &&
    hasSkillsContent(extractedSkills)
  );
}

function updatePrimaryActionsVisibility() {
  updateJobCostPanel();
}

function showStatus(message: string, type: 'success' | 'error' | 'info' = 'info') {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
}

function hideStatus() {
  statusEl.classList.add('hidden');
}

function showAuthUI() {
  authSection.classList.remove('hidden');
  mainSection.classList.add('hidden');
}

function showMainUI(email: string) {
  authSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
  userEmail.textContent = email || 'Signed in';
  userAvatar.textContent = email?.charAt(0).toUpperCase() || '?';
  jobCostPanel.classList.remove('hidden');
  companyBulletsSection.classList.remove('hidden');
  updateJobCostPanel();
}

async function init() {
  hideStatus();

  const auth = await ensureAuthenticatedSession();

  if (!auth?.token) {
    showAuthUI();
    return;
  }

  showMainUI(auth.email || '');
  jdText.readOnly = true;
  skillsText.readOnly = false;
  skillsText.addEventListener('blur', () => {
    applySkillsFromEditor();
  });
  await loadProfiles(auth.token);
  await extractJobFromTab();
  await refreshJobSkillsAndApplication();

  updatePrimaryActionsVisibility();
  updateActionButtons();
}

function setupSessionRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void refreshAuthSession();
    }
  });

  window.addEventListener('focus', () => {
    void refreshAuthSession();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.token) {
      if (changes.token.newValue) {
        void init();
      } else {
        showAuthUI();
      }
    }
  });
}

function setupJobDetectionListener() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'JOB_DETECTED' || !message.job) return;

    const job = message.job as ExtractedJob;
    const key = getJobDetectionKey(job);
    const desc = job.jobDescription?.trim() || '';

    if (key === lastAutoDetectedJobKey) {
      if (!desc || desc.length <= jdText.value.trim().length + 30) return;
    } else if (!desc) {
      return;
    }

    displayJob(job);
  });
}

async function refreshAuthSession() {
  const auth = await ensureAuthenticatedSession();
  if (!auth?.token) {
    showAuthUI();
  }
}

function parseSkillString(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split('&').map((item) => item.trim()).filter(Boolean);
}

function getHardSkillsForHighlight(): string[] {
  if (!extractedSkills?.hardSkills) return [];
  return parseSkillString(extractedSkills.hardSkills);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TextMatch {
  start: number;
  end: number;
}

function findSkillMatches(text: string, skills: string[]): TextMatch[] {
  const matches: TextMatch[] = [];

  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;

    const pattern = escapeRegExp(trimmed).replace(/\s+/g, '\\s+');
    const regex = new RegExp(pattern, 'gi');
    let match: RegExpExecArray | null = regex.exec(text);

    while (match) {
      matches.push({ start: match.index, end: match.index + match[0].length });
      match = regex.exec(text);
    }
  }

  if (matches.length === 0) return [];

  const sorted = matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function buildHighlightedHtml(
  text: string,
  matches: TextMatch[],
  markClass = 'skill-highlight',
): string {
  if (!text) return '';
  if (matches.length === 0) return escapeHtml(text);

  let html = '';
  let lastIndex = 0;

  for (const match of matches) {
    html += escapeHtml(text.slice(lastIndex, match.start));
    html += `<mark class="${markClass}">${escapeHtml(text.slice(match.start, match.end))}</mark>`;
    lastIndex = match.end;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
}

function findJdLocationMatches(text: string): TextMatch[] {
  const matches: TextMatch[] = [];

  for (const pattern of JD_LOCATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null = regex.exec(text);

    while (match) {
      matches.push({ start: match.index, end: match.index + match[0].length });
      match = regex.exec(text);
    }
  }

  if (matches.length === 0) return [];

  const sorted = matches.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function updateJdHighlight(): void {
  const text = jdText.value;
  const matches = findJdLocationMatches(text);
  jdHighlight.innerHTML =
    buildHighlightedHtml(text, matches, 'jd-location-highlight') || '&nbsp;';
}

function syncJdScroll(): void {
  jdHighlight.scrollTop = jdText.scrollTop;
  jdHighlight.scrollLeft = jdText.scrollLeft;
}

function updateBulletHighlight(textarea: HTMLTextAreaElement): void {
  const highlight = textarea.parentElement?.querySelector(
    '.company-bullet-highlight',
  ) as HTMLDivElement | null;
  if (!highlight) return;

  const matches = findSkillMatches(textarea.value, getHardSkillsForHighlight());
  highlight.innerHTML = buildHighlightedHtml(textarea.value, matches) || '&nbsp;';
}

function syncBulletEditorScroll(textarea: HTMLTextAreaElement): void {
  const highlight = textarea.parentElement?.querySelector(
    '.company-bullet-highlight',
  ) as HTMLDivElement | null;
  if (!highlight) return;

  highlight.scrollTop = textarea.scrollTop;
  highlight.scrollLeft = textarea.scrollLeft;
}

function refreshAllCompanyBulletHighlights(): void {
  companyBulletsList
    .querySelectorAll<HTMLTextAreaElement>('textarea[data-company-index]')
    .forEach(updateBulletHighlight);
}

function createBulletEditor(
  index: number,
  companyName: string,
): { editor: HTMLDivElement; textarea: HTMLTextAreaElement } {
  const editor = document.createElement('div');
  editor.className = 'company-bullet-editor';

  const highlight = document.createElement('div');
  highlight.className = 'company-bullet-highlight';
  highlight.setAttribute('aria-hidden', 'true');

  const textarea = document.createElement('textarea');
  textarea.className = 'company-bullet-text';
  textarea.rows = 4;
  textarea.dataset.companyIndex = String(index);
  textarea.placeholder = `One bullet per line, e.g. ${BULLET_LINE_PREFIX}Achievement...`;
  textarea.spellcheck = false;

  bindBulletTextarea(textarea, () => {
    updateBulletHighlight(textarea);
    markResumeInputsChanged();
    updateActionButtons();
  });
  textarea.addEventListener('scroll', () => syncBulletEditorScroll(textarea));

  editor.appendChild(highlight);
  editor.appendChild(textarea);

  return { editor, textarea };
}

function displaySkillTags(skills: string[]) {
  jobSkills.innerHTML = skills
    .slice(0, 12)
    .map((s) => `<span class="skill-tag">${s}</span>`)
    .join('');
}

function hasSkillsContent(skills: ApplicationSkills | null): boolean {
  if (!skills) return false;
  return Boolean(
    skills.hardSkills?.trim() ||
      skills.additionalHardSkills?.trim() ||
      skills.competencies?.trim() ||
      skills.title?.trim() ||
      skills.focus?.trim() ||
      skills.role?.trim(),
  );
}

function resolveResumeTemplateFormat(profile: Profile): 'text' | 'docx' | '' {
  if (profile.resumeTemplateFormat === 'docx' || profile.resumeTemplateFormat === 'text') {
    return profile.resumeTemplateFormat;
  }
  if (profile.resumeTemplateFilePath?.trim()) return 'docx';
  if (profile.resumeTemplate?.trim()) return 'text';
  return '';
}

function profileHasTemplate(): boolean {
  const profile = getSelectedProfile();
  if (!profile) return false;

  const format = resolveResumeTemplateFormat(profile);
  if (format === 'docx') {
    return Boolean(
      profile.resumeTemplateFilePath?.trim() || profile.resumeTemplateFileName?.trim(),
    );
  }
  if (format === 'text') {
    return Boolean(profile.resumeTemplate?.trim());
  }

  return Boolean(profile.resumeTemplateFileName?.trim());
}

function textareaHasBulletContent(textarea: HTMLTextAreaElement): boolean {
  const text = textarea.value.trim();
  if (!text) return false;

  return text
    .split('\n')
    .some((line) => stripBulletLinePrefix(line).trim().length > 0);
}

function allCompanyBulletsFilled(): boolean {
  const companies = getSelectedCompanies();
  const textareas = companyBulletsList.querySelectorAll<HTMLTextAreaElement>(
    'textarea.company-bullet-text',
  );

  if (companies.length === 0) return false;

  if (textareas.length !== companies.length) return false;

  return Array.from(textareas).every(textareaHasBulletContent);
}

function getGenerateResumeBlockers(): string[] {
  const blockers: string[] = [];
  const companies = getSelectedCompanies();
  const textareas = companyBulletsList.querySelectorAll('textarea.company-bullet-text');

  if (!profileSelect.value) blockers.push('Select a profile');
  if (!hasSkillsContent(extractedSkills)) blockers.push('Extract skills first');
  if (companies.length === 0) blockers.push('Add companies to your profile in the dashboard');
  else if (textareas.length !== companies.length) {
    blockers.push('Click Refresh next to Profile to sync company list');
  } else if (!allCompanyBulletsFilled()) {
    blockers.push('Generate bullets for every company');
  }
  if (!profileHasTemplate()) {
    blockers.push('Upload a resume template in the dashboard (then refresh profiles)');
  }
  return blockers;
}

async function refreshSelectedProfile(token?: string): Promise<void> {
  const selectedId = profileSelect.value;
  if (!selectedId) return;

  const authToken = token || (await getStorage()).token;
  if (!authToken) return;

  try {
    const fresh = await apiRequest<Profile>(`/profiles/${selectedId}`, { token: authToken });
    const index = profiles.findIndex((profile) => profile.id === selectedId);
    if (index >= 0) {
      profiles[index] = { ...profiles[index], ...fresh };
    } else {
      profiles.push(fresh);
    }
  } catch {
    // Keep cached profile data if refresh fails.
  }
}

function syncSkillsEditorBaseline(): void {
  skillsEditorBaseline = skillsText.value;
}

function applySkillsFromEditor(): boolean {
  const raw = skillsText.value.trim();
  if (raw === skillsEditorBaseline) {
    return true;
  }

  if (!raw) {
    extractedSkills = null;
    skillsExtractedForDescription = '';
    skillsExtractedForJobId = '';
    jobSkills.innerHTML = '';
    syncSkillsEditorBaseline();
    markResumeInputsChanged();
    updateActionButtons();
    return false;
  }

  try {
    const parsed = JSON.parse(raw) as ApplicationSkills;
    if (!hasSkillsContent(parsed)) {
      showStatus('Skills JSON must include at least one skill field.', 'error');
      return false;
    }

    extractedSkills = parsed;
    skillsExtractedForDescription = jdText.value.trim();
    skillsExtractedForJobId = getCurrentLinkedInJobId();

    const tags = [
      ...parseSkillString(parsed.hardSkills),
      ...parseSkillString(parsed.additionalHardSkills),
      ...parseSkillString(parsed.competencies).slice(0, 4),
    ];
    displaySkillTags([...new Set(tags)]);
    refreshAllCompanyBulletHighlights();
    syncSkillsEditorBaseline();
    markResumeInputsChanged();
    updateActionButtons();
    return true;
  } catch {
    showStatus('Skills JSON is invalid.', 'error');
    return false;
  }
}

function displaySkillsJson(
  skills: ApplicationSkills,
  options?: { skipDirty?: boolean },
) {
  extractedSkills = skills;
  skillsExtractedForDescription = jdText.value.trim();
  skillsExtractedForJobId = getCurrentLinkedInJobId();
  skillsText.value = JSON.stringify(skills, null, 2);
  syncSkillsEditorBaseline();

  const tags = [
    ...parseSkillString(skills.hardSkills),
    ...parseSkillString(skills.additionalHardSkills),
    ...parseSkillString(skills.competencies).slice(0, 4),
  ];
  displaySkillTags([...new Set(tags)]);
  refreshAllCompanyBulletHighlights();
  if (!options?.skipDirty) {
    markResumeInputsChanged();
  }
  updateActionButtons();
}

function clearSkillsField() {
  extractedSkills = null;
  pendingSkillExtractionCostUsd = 0;
  skillsExtractedForDescription = '';
  skillsExtractedForJobId = '';
  skillsText.value = '';
  skillsEditorBaseline = '';
  jobSkills.innerHTML = '';
  markResumeInputsChanged();
  updateActionButtons();
}

function normalizeCompanies(raw: Profile['companies']): ProfileCompany[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): ProfileCompany | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name, prompt: '', bulletCount: 1 } : null;
      }
      if (!item?.name?.trim()) return null;
      const bulletCount = Number(item.bulletCount);
      return {
        name: item.name.trim(),
        prompt: String(item.prompt || item.companyPrompt || ''),
        bulletCount: Number.isFinite(bulletCount) && bulletCount >= 1
          ? Math.floor(bulletCount)
          : 1,
      };
    })
    .filter((item): item is ProfileCompany => item !== null);
}

function getSelectedProfile(): Profile | undefined {
  return profiles.find((p) => p.id === profileSelect.value);
}

function collectAllCompanyBullets(): { company: string; bullets: string }[] {
  const companies = getSelectedCompanies();

  return companies.map((company, index) => {
    const textarea = companyBulletsList.querySelector<HTMLTextAreaElement>(
      `textarea[data-company-index="${index}"]`,
    );
    return {
      company: company.name,
      bullets: textarea?.value.trim() || '',
    };
  });
}

function getSelectedCompanies(): ProfileCompany[] {
  return normalizeCompanies(getSelectedProfile()?.companies);
}

function getCompanyBulletCounts(): { companyName: string; bulletCount: number }[] {
  const companies = getSelectedCompanies();

  return companies.map((company, index) => {
    const countInput = companyBulletsList.querySelector<HTMLInputElement>(
      `input.company-bullet-count[data-company-index="${index}"]`,
    );

    return {
      companyName: company.name,
      bulletCount: Math.max(1, Number(countInput?.value) || company.bulletCount || 1),
    };
  });
}

function applyCompanyBulletResult(
  companyIndex: number,
  _companyName: string,
  bullets: string[],
  options?: { skipDirty?: boolean },
): number {
  const textarea = companyBulletsList.querySelector<HTMLTextAreaElement>(
    `textarea[data-company-index="${companyIndex}"]`,
  );

  if (textarea) {
    textarea.value = formatBulletLines(bullets.filter(Boolean).join('\n'));
    resetBulletTextareaBaseline(textarea);
    updateBulletHighlight(textarea);
    if (!options?.skipDirty) {
      markResumeInputsChanged();
    }
  }

  return bullets.filter((bullet) => bullet.trim()).length;
}

function renderCompanyBulletFields() {
  const companies = getSelectedCompanies();

  companyBulletsList.innerHTML = '';
  companyBulletsSection.classList.remove('hidden');

  companies.forEach((company, index) => {
    const item = document.createElement('div');
    item.className = 'company-bullet-item';

    const header = document.createElement('div');
    header.className = 'company-bullet-header';

    const label = document.createElement('span');
    label.className = 'company-bullet-label';
    label.dataset.companyIndex = String(index);
    label.innerHTML = buildCompanyLabelHtml(company.name);

    const controls = document.createElement('div');
    controls.className = 'company-bullet-controls';

    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.max = '10';
    countInput.className = 'company-bullet-count';
    countInput.value = String(company.bulletCount || 1);
    countInput.title = 'Number of bullets to generate';
    countInput.dataset.companyIndex = String(index);

    controls.appendChild(countInput);

    header.appendChild(label);
    header.appendChild(controls);

    const { editor, textarea } = createBulletEditor(index, company.name);

    item.appendChild(header);
    item.appendChild(editor);
    companyBulletsList.appendChild(item);
  });

  updateActionButtons();
}

async function performExtractSkills(token: string): Promise<ExtractApplicationSkillsResponse> {
  if (!canExtractSkills()) {
    throw new Error('Load a job description before extracting skills.');
  }

  const description = jdText.value.trim();
  const jobData = getJobData(description);

  const response = await apiRequest<ExtractApplicationSkillsResponse>(
    '/applications/extract-skills',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        jobDescription: description,
        companyName: jobData.companyName,
        applicationId: lastApplicationId || undefined,
        linkedInJobId: getCurrentLinkedInJobId() || undefined,
      }),
    },
  );

  displaySkillsJson(response.skills);
  skillsLoadedFromCache = Boolean(response.fromCache);
  pendingSkillExtractionCostUsd = response.fromCache ? 0 : (response.costUsd ?? 0);

  if (lastApplicationId) {
    await refreshCostFromApplication(token);
  } else if (!response.fromCache && response.costUsd && response.costUsd > 0) {
    addLocalCost('skillExtraction', response.costUsd);
    updateJobCostPanel();
  } else {
    updateJobCostPanel();
  }

  if (profileSelect.value) {
    await refreshSelectedProfile(token);
    updateActionButtons();
  }

  if (!hasSkillsContent(response.skills)) {
    throw new Error(
      'AI returned no skills. Check OPENAI_API_KEY in the API .env and restart the server.',
    );
  }

  return response;
}

async function performGenerateAllBullets(token: string): Promise<GenerateAllCompanyBulletsResponse> {
  const profile = getSelectedProfile();
  const companies = getSelectedCompanies();
  if (!profile || companies.length === 0) {
    throw new Error('Select a profile with companies before generating bullets.');
  }
  if (!canGenerateAllBullets()) {
    throw new Error('Extract skills before generating resume bullets.');
  }

  const jobData = getJobData(jdText.value.trim());
  const companyRequests = getCompanyBulletCounts();

  const response = await apiRequest<GenerateAllCompanyBulletsResponse>(
    '/resumes/generate-all-bullets',
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        profileId: profile.id,
        skills: extractedSkills,
        companies: companyRequests,
        jobDescription: jdText.value.trim() || undefined,
        targetJobCompany: jobData.companyName,
        targetJobTitle: jobData.jobTitle,
        applicationId: lastApplicationId || undefined,
      }),
    },
  );

  response.results.forEach((result) => {
    const companyIndex = companies.findIndex((company) => company.name === result.company);
    if (companyIndex === -1) return;

    applyCompanyBulletResult(companyIndex, result.company, result.bullets, {
      skipDirty: true,
    });
  });

  if (lastApplicationId) {
    await refreshCostFromApplication(token);
  } else if (response.costUsd && response.costUsd > 0) {
    addLocalCost('resumeBullets', response.costUsd);
  } else {
    updateJobCostPanel();
  }

  if (profileSelect.value) {
    await refreshSelectedProfile(token);
  }

  updateActionButtons();

  if (!allCompanyBulletsFilled()) {
    throw new Error('Resume bullets could not be generated for every company.');
  }

  return response;
}

async function performGenerateResume(token: string) {
  if (!profileSelect.value) {
    throw new Error('Select a profile first.');
  }

  if (!applySkillsFromEditor() && !hasSkillsContent(extractedSkills)) {
    throw new Error('Fix the skills JSON before generating a resume.');
  }

  if (!extractedSkills) {
    throw new Error('Select a profile and extract skills first.');
  }

  if (!allCompanyBulletsFilled()) {
    throw new Error('Fill in resume bullets for every company first.');
  }

  if (!profileHasTemplate()) {
    throw new Error('Upload a resume template for this profile in the dashboard.');
  }

  const companyBullets = collectAllCompanyBullets();
  const application = await saveApplication(token);
  if (!application) {
    throw new Error('Could not save application before generating resume.');
  }

  const resume = await apiRequest<{
    id?: string;
    content?: string;
    filePath?: string;
    fileUrl?: string;
    fileName?: string;
    applicationAiCostUsd?: number;
  }>('/resumes/generate', {
    method: 'POST',
    token,
    body: JSON.stringify({
      applicationId: application.id,
      profileId: profileSelect.value,
      skills: extractedSkills,
      companyBullets,
    }),
  });

  lastGeneratedResume = {
    filePath: resume.filePath,
    fileName: resume.fileName,
    fileUrl: resume.fileUrl,
  };
  if (resume.id) {
    lastResumeId = resume.id;
  }
  showResumeDownload(resume.fileName || 'Resume');
  commitResumeInputSnapshot();
  await refreshCostFromApplication(token);

  return resume;
}

function showWorkflowOverlay(message: string) {
  workflowOverlayMessage.textContent = message;
  workflowOverlay.classList.remove('hidden');
  workflowOverlay.setAttribute('aria-busy', 'true');
}

function setWorkflowOverlayMessage(message: string) {
  workflowOverlayMessage.textContent = message;
}

function hideWorkflowOverlay() {
  workflowOverlay.classList.add('hidden');
  workflowOverlay.setAttribute('aria-busy', 'false');
}

function getOneClickDoneBlockers(): string[] {
  const blockers: string[] = [];

  if (!hasLoadedJobDescription()) {
    blockers.push('Load a job description first');
  }
  if (!profileSelect.value) {
    blockers.push('Select a profile');
  }
  if (getSelectedCompanies().length === 0) {
    blockers.push('Add companies to your profile');
  }
  if (!profileHasTemplate()) {
    blockers.push('Upload a resume template');
  }

  return blockers;
}

function canOneClickDone(): boolean {
  return hasLoadedJobDescription() && !oneClickInProgress;
}

async function runOneClickDone() {
  const blockers = getOneClickDoneBlockers();
  if (blockers.length > 0) {
    showStatus(blockers.join(' · '), 'error');
    return;
  }

  const storage = await getStorage();
  if (!storage.token) return;

  oneClickInProgress = true;
  hideStatus();
  updateActionButtons();
  showWorkflowOverlay('Extracting skills from job description...');

  try {
    await performExtractSkills(storage.token);

    if (profileSelect.value && companyBulletsList.children.length === 0) {
      renderCompanyBulletFields();
    }

    setWorkflowOverlayMessage('Saving application...');
    const savedApplication = await saveApplication(storage.token);
    if (!savedApplication) {
      throw new Error('Could not save application before generating resume bullets.');
    }

    setWorkflowOverlayMessage('Generating resume bullets...');
    await performGenerateAllBullets(storage.token);

    setWorkflowOverlayMessage('Saving application and generating resume...');
    await performGenerateResume(storage.token);

    showStatus(
      'One-Click Done — skills extracted, bullets generated, and resume saved.',
      'success',
    );
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'One-Click Done failed', 'error');
  } finally {
    oneClickInProgress = false;
    hideWorkflowOverlay();
    updateActionButtons();
  }
}

async function generateAllCompanyBullets() {
  const profile = getSelectedProfile();
  const companies = getSelectedCompanies();
  if (!profile || companies.length === 0 || !canGenerateAllBullets()) return;

  const storage = await getStorage();
  if (!storage.token) return;

  hideStatus();
  btnGenerateAllBullets.disabled = true;
  btnGenerateAllBullets.textContent = 'Generating...';

  try {
    const response = await performGenerateAllBullets(storage.token);
    const totalFilled = response.results.reduce((count, result) => {
      const companyIndex = getSelectedCompanies().findIndex(
        (company) => company.name === result.company,
      );
      return companyIndex === -1 ? count : count + result.bullets.length;
    }, 0);

    showStatus(
      totalFilled > 0
        ? `Generated ${totalFilled} bullets across ${response.results.length} companies.`
        : 'No bullets were generated.',
      totalFilled > 0 ? 'success' : 'info',
    );
  } catch (err) {
    showStatus(
      err instanceof Error ? err.message : 'Failed to generate all company bullets',
      'error',
    );
  } finally {
    btnGenerateAllBullets.textContent = 'Generate All Resume Bullets';
    updateActionButtons();
  }
}

function hasLoadedJobDescription(): boolean {
  return jdText.value.trim().length > 0;
}

function canExtractSkills(): boolean {
  return hasLoadedJobDescription();
}

function canGenerateAllBullets(): boolean {
  return hasSkillsContent(extractedSkills);
}

function updateActionButtons() {
  const hasJd = hasLoadedJobDescription();
  const hasSkills = canGenerateAllBullets();
  const generateBlockers = getGenerateResumeBlockers();
  const resumeUpToDate = isResumeUpToDate();

  btnExtractSkills.disabled = !canExtractSkills() || oneClickInProgress;
  btnExtractSkills.title = hasJd
    ? 'Extract skills from the job description with AI'
    : 'Open a LinkedIn job and load the description first';
  updatePrimaryActionsVisibility();
  btnGenerate.disabled =
    generateBlockers.length > 0 || oneClickInProgress || resumeUpToDate;
  btnGenerate.title =
    generateBlockers.length > 0
      ? generateBlockers.join(' · ')
      : resumeUpToDate
        ? 'Resume matches current skills and bullets'
        : lastGeneratedResume?.filePath || lastResumeId
          ? 'Regenerate resume with your latest changes'
          : 'Generate tailored resume from your template and company bullets';

  btnOneClickDone.disabled = !canOneClickDone();
  const oneClickBlockers = getOneClickDoneBlockers();
  btnOneClickDone.title = !hasJd
    ? 'Open a LinkedIn job and load the description first'
    : oneClickInProgress
      ? 'Running One-Click Done...'
      : oneClickBlockers.length > 0
        ? oneClickBlockers.join(' · ')
        : 'Extract skills, generate bullets, finalize resume, and save';

  btnDownloadResume.disabled = !lastGeneratedResume?.filePath || oneClickInProgress;

  const hasCompanies = getSelectedCompanies().length > 0;
  btnGenerateAllBullets.disabled = !hasSkills || !hasCompanies || oneClickInProgress;
  btnGenerateAllBullets.title = !hasSkills
    ? 'Extract skills before generating resume bullets'
    : !hasCompanies
      ? 'Add companies to your profile'
      : 'Generate bullets for every company using each bullet count';

  updateAppliedButton();
}

function updateAppliedButton() {
  if (applicationStatus === 'applied') {
    btnApplied.disabled = true;
    btnApplied.textContent = 'Applied';
    btnApplied.title = 'This application is marked as applied';
    return;
  }

  btnApplied.textContent = 'Applied';
  btnApplied.title = 'Mark this application as submitted';
  btnApplied.disabled =
    applicationStatus === 'applied' || !canRecordApplication() || oneClickInProgress;
}

function setCompanyAvatar(logoUrl: string | undefined, companyName: string) {
  companyAvatar.innerHTML = '';
  companyAvatar.classList.remove('has-logo');

  if (logoUrl) {
    const img = document.createElement('img');
    img.src = logoUrl;
    img.alt = `${companyName} logo`;
    img.className = 'company-avatar-img';
    img.addEventListener('error', () => {
      companyAvatar.innerHTML = '';
      companyAvatar.textContent = companyName.charAt(0).toUpperCase();
      companyAvatar.classList.remove('has-logo');
    });
    companyAvatar.classList.add('has-logo');
    companyAvatar.appendChild(img);
    return;
  }

  companyAvatar.textContent = companyName.charAt(0).toUpperCase();
}

function displayJob(job: ExtractedJob) {
  lastAutoDetectedJobKey = getJobDetectionKey(job);

  const incomingJobId = job.linkedInJobId?.trim() || '';
  const previousJobId = getCurrentLinkedInJobId();
  const isSameJobId = Boolean(
    incomingJobId && previousJobId && incomingJobId === previousJobId,
  );

  if (!isSameJobId) {
    resetWorkflowState();
    clearSkillsField();
    clearCompanyBulletFields();
    resetJobCosts();
  }

  currentJob = job;
  jobTitle.textContent = job.jobTitle;
  jobCompany.textContent = [job.companyName, job.location].filter(Boolean).join(' · ');
  setCompanyAvatar(job.companyLogoUrl, job.companyName);
  jdText.value = job.jobDescription;
  updateJdHighlight();

  jobPanel.classList.remove('hidden');
  noJob.classList.add('hidden');
  void refreshJobSkillsAndApplication();
  updateActionButtons();
}

function clearJobDisplay() {
  currentJob = null;
  lastAutoDetectedJobKey = '';
  clearSkillsField();
  clearCompanyBulletFields();
  resetJobCosts();
  jdText.value = '';
  updateJdHighlight();
  companyAvatar.innerHTML = '?';
  companyAvatar.classList.remove('has-logo');
  jobPanel.classList.add('hidden');
  noJob.classList.remove('hidden');
  resetApplicationPrefillState({ keepSkills: false });
  updateActionButtons();
}

function getJobData(description: string) {
  const linkedInJobUrl =
    currentJob?.linkedInJobUrl || currentJob?.jobUrl || '';
  const realJobUrl = currentJob?.realJobUrl || '';

  return currentJob || {
    companyName: jobCompany.textContent?.split(' · ')[0] || 'Unknown',
    jobTitle: jobTitle.textContent || 'Unknown',
    jobDescription: description,
    hardSkills: [],
    competencies: [],
    location: '',
    jobUrl: linkedInJobUrl,
    linkedInJobUrl,
    realJobUrl,
    companyLogoUrl: undefined,
  };
}

function buildApplicationUpdatePayload(description: string) {
  const jobData = getJobData(description);

  return {
    profileId: profileSelect.value,
    companyName: jobData.companyName,
    jobTitle: jobData.jobTitle,
    jobDescription: description,
    linkedInJobUrl: jobData.linkedInJobUrl || jobData.jobUrl,
    linkedInJobId: currentJob?.linkedInJobId || getCurrentLinkedInJobId() || undefined,
    realJobUrl: jobData.realJobUrl || '',
    jobUrl: jobData.linkedInJobUrl || jobData.jobUrl,
    location: jobData.location,
    companyLogoUrl: jobData.companyLogoUrl,
    skills: extractedSkills || undefined,
    companyBullets: collectAllCompanyBullets(),
    resumeId: lastResumeId || undefined,
  };
}

function buildApplicationCreatePayload(description: string) {
  return {
    ...buildApplicationUpdatePayload(description),
    skipSkillExtraction: Boolean(extractedSkills),
    pendingSkillExtractionCostUsd:
      extractedSkills && pendingSkillExtractionCostUsd > 0
        ? pendingSkillExtractionCostUsd
        : undefined,
  };
}

async function ensureContentScript(tabId: number): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function requestJobExtraction(tabId: number): Promise<{ job: ExtractedJob | null } | null> {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_JOB' });
}

async function extractJobFromTab(showFeedback = false) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url?.includes('linkedin.com')) {
      clearJobDisplay();
      if (showFeedback) {
        showStatus('Open a LinkedIn job page first.', 'error');
      }
      return;
    }

    if (showFeedback) {
      btnRefreshJd.disabled = true;
      btnRefreshJd.textContent = 'Loading...';
      btnRefreshJdEmpty.disabled = true;
      btnRefreshJdEmpty.textContent = 'Loading...';
    }

    const response = await requestJobExtraction(tab.id);

    if (response?.job?.jobDescription) {
      displayJob(response.job);
      if (showFeedback) {
        showStatus('Job description extracted.', 'success');
      }
    } else if (response?.job) {
      displayJob(response.job);
      if (showFeedback) {
        showStatus('Job found but description is empty. Scroll to "About the job" and try again.', 'info');
      }
    } else {
      clearJobDisplay();
      if (showFeedback) {
        showStatus('Could not find job details on this page.', 'error');
      }
    }
  } catch {
    clearJobDisplay();
    if (showFeedback) {
      showStatus('Refresh the LinkedIn tab, then click Refresh JD again.', 'error');
    }
  } finally {
    btnRefreshJd.disabled = false;
    btnRefreshJd.textContent = 'Refresh JD';
    btnRefreshJdEmpty.disabled = false;
    btnRefreshJdEmpty.textContent = 'Refresh JD';
    updateActionButtons();
  }
}

async function extractSkillsFromApi() {
  if (!canExtractSkills()) {
    showStatus('Load a job description before extracting skills.', 'error');
    updateActionButtons();
    return;
  }

  const storage = await getStorage();
  if (!storage.token) return;

  hideStatus();
  btnExtractSkills.disabled = true;
  btnExtractSkills.textContent = 'Extracting...';

  try {
    const response = await performExtractSkills(storage.token);

    if (!hasSkillsContent(response.skills)) {
      showStatus(
        'AI returned no skills. Check OPENAI_API_KEY in the API .env and restart the server.',
        'info',
      );
    } else {
      const parts = [response.fromCache ? 'Loaded saved skills for this job.' : 'Skills extracted.'];
      if (response.skills.title) parts.push(`Title: ${response.skills.title}.`);
      if (response.skills.focus) parts.push(`Focus: ${response.skills.focus}.`);
      showStatus(parts.join(' '), 'success');
    }
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to extract skills', 'error');
  } finally {
    btnExtractSkills.textContent = 'Extract Skills';
    updateActionButtons();
  }
}

async function loadProfiles(token: string, options?: { notify?: boolean }) {
  const previousSelection = profileSelect.value;
  const previousCompaniesCount = previousSelection
    ? normalizeCompanies(profiles.find((profile) => profile.id === previousSelection)?.companies)
        .length
    : 0;
  const previousDomTextareaCount = companyBulletsList.querySelectorAll(
    'textarea.company-bullet-text',
  ).length;

  try {
    profiles = await apiRequest<Profile[]>('/profiles', { token });
    profileSelect.innerHTML = '<option value="">Select a profile...</option>';
    profiles.forEach((p) => {
      const option = document.createElement('option');
      option.value = p.id;
      option.textContent = p.profileName;
      profileSelect.appendChild(option);
    });

    let nextSelection = '';
    if (previousSelection && profiles.some((p) => p.id === previousSelection)) {
      nextSelection = previousSelection;
    } else if (profiles.length === 1) {
      nextSelection = profiles[0].id;
    }

    profileSelect.value = nextSelection;

    if (nextSelection) {
      await refreshSelectedProfile(token);
    }

    const selectedProfile = profiles.find((profile) => profile.id === nextSelection);
    const nextCompaniesCount = normalizeCompanies(selectedProfile?.companies).length;
    const profileChanged = nextSelection !== previousSelection;
    const companiesChanged =
      nextCompaniesCount !== previousCompaniesCount ||
      nextCompaniesCount !== previousDomTextareaCount;

    if (profileChanged || companiesChanged || companyBulletsList.childElementCount === 0) {
      renderCompanyBulletFields();
    } else {
      updatePrimaryActionsVisibility();
      updateActionButtons();
    }

    await refreshJobSkillsAndApplication();

    if (options?.notify) {
      showStatus(
        profiles.length
          ? `Loaded ${profiles.length} profile${profiles.length === 1 ? '' : 's'}.`
          : 'No profiles yet. Create one in the dashboard.',
        profiles.length ? 'success' : 'info',
      );
    }
  } catch (err) {
    profiles = [];
    showStatus(
      err instanceof Error ? err.message : 'Could not load profiles. Is the API running?',
      'error',
    );
  }
}

async function refreshProfiles() {
  const auth = await ensureAuthenticatedSession();
  if (!auth?.token) {
    showAuthUI();
    showStatus('Sign in to load profiles.', 'error');
    return;
  }

  btnRefreshProfiles.disabled = true;
  btnRefreshProfiles.textContent = '...';

  try {
    await loadProfiles(auth.token, { notify: true });
  } finally {
    btnRefreshProfiles.disabled = false;
    btnRefreshProfiles.textContent = 'Refresh';
  }
}

document.getElementById('btn-signin')!.addEventListener('click', () => {
  openAuthPage('signin');
});

dashboardLink.href = '#';
dashboardLink.addEventListener('click', (event) => {
  event.preventDefault();
  openWebApp('/profiles');
});

btnRefreshProfiles.addEventListener('click', () => {
  void refreshProfiles();
});

document.getElementById('btn-signup')!.addEventListener('click', () => {
  openAuthPage('signup');
});

document.getElementById('btn-signout')!.addEventListener('click', async () => {
  await signOut();
  profiles = [];
  currentJob = null;
  extractedSkills = null;
  lastAutoDetectedJobKey = '';
  resetWorkflowState();
  clearJobDisplay();
  showAuthUI();
});

profileSelect.addEventListener('change', () => {
  markResumeInputsChanged();
  resetJobCosts();
  void (async () => {
    await refreshSelectedProfile();
    renderCompanyBulletFields();
    await refreshJobSkillsAndApplication();
    updatePrimaryActionsVisibility();
    updateActionButtons();
  })();
});

jdText.addEventListener('scroll', () => {
  syncJdScroll();
});

const refreshJobDescription = () => extractJobFromTab(true);
btnRefreshJd.addEventListener('click', refreshJobDescription);
btnRefreshJdEmpty.addEventListener('click', refreshJobDescription);
btnExtractSkills.addEventListener('click', () => {
  if (!canExtractSkills()) return;
  void extractSkillsFromApi();
});
btnGenerateAllBullets.addEventListener('click', () => {
  if (!canGenerateAllBullets()) return;
  void generateAllCompanyBullets();
});
btnOneClickDone.addEventListener('click', () => {
  if (!canOneClickDone()) return;
  void runOneClickDone();
});

async function saveApplication(token: string): Promise<StoredApplication | null> {
  const description = jdText.value.trim();
  if (!description || !profileSelect.value) return null;

  if (!lastApplicationId) {
    const linkedInJobId = getCurrentLinkedInJobId();
    const profileId = profileSelect.value;
    if (linkedInJobId && profileId) {
      try {
        const existing = await apiRequest<StoredApplication | null>(
          `/applications/lookup?linkedInJobId=${encodeURIComponent(linkedInJobId)}&profileId=${encodeURIComponent(profileId)}`,
          { token },
        );
        if (existing?.id) {
          lastApplicationId = existing.id;
          applicationStatus =
            existing.status === 'applied' ? 'applied' : 'recorded';
        }
      } catch {
        // Continue with create when lookup fails.
      }
    }
  }

  const payload = lastApplicationId
    ? buildApplicationUpdatePayload(description)
    : buildApplicationCreatePayload(description);
  const application = lastApplicationId
    ? await apiRequest<StoredApplication>(`/applications/${lastApplicationId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      })
    : await apiRequest<StoredApplication>('/applications', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });

  lastApplicationId = application.id;
  applicationStatus = application.status === 'applied' ? 'applied' : 'recorded';
  lastResumeId = application.resumeId || lastResumeId;
  await setStorage({ lastApplicationId: application.id });
  pendingSkillExtractionCostUsd = 0;

  if (application.skills) {
    displaySkillsJson(application.skills, { skipDirty: true });
  }

  if (application.aiCostBreakdown || application.aiCostUsd) {
    applyCostBreakdownFromApplication(application);
  }

  if (applicationStatus === 'recorded') {
    showApplicationNotice('recorded');
  } else if (applicationStatus === 'applied') {
    showApplicationNotice('applied');
  }
  return application;
}

async function markApplicationApplied(token: string): Promise<StoredApplication | null> {
  const saved = await saveApplication(token);
  if (!saved) return null;

  const application = await apiRequest<StoredApplication>(
    `/applications/${saved.id}/applied`,
    {
      method: 'PATCH',
      token,
    },
  );

  lastApplicationId = application.id;
  applicationStatus = 'applied';
  showApplicationNotice('applied');
  updateAppliedButton();
  return application;
}

btnApplied.addEventListener('click', async () => {
  if (applicationStatus === 'applied') return;

  const storage = await getStorage();
  if (!storage.token) return;

  if (!canRecordApplication()) {
    showStatus('Select a profile and extract skills before marking as applied.', 'error');
    return;
  }

  hideStatus();
  btnApplied.disabled = true;
  btnApplied.textContent = 'Updating...';

  try {
    await markApplicationApplied(storage.token);
    showStatus('Application marked as applied.', 'success');
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to mark as applied', 'error');
  } finally {
    updateAppliedButton();
    updateActionButtons();
  }
});

btnGenerate.addEventListener('click', async () => {
  if (!profileSelect.value || !extractedSkills) return;

  if (!allCompanyBulletsFilled()) {
    showStatus('Fill in resume bullets for every company first.', 'error');
    return;
  }

  if (!profileHasTemplate()) {
    showStatus('Upload a resume template for this profile in the dashboard.', 'error');
    return;
  }

  const storage = await getStorage();
  if (!storage.token) return;

  hideStatus();
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Generating...';

  try {
    await performGenerateResume(storage.token);

    showStatus(
      lastGeneratedResume?.filePath || lastGeneratedResume?.fileUrl
        ? 'Resume generated from your template and company bullets.'
        : 'Resume generated successfully.',
      'success',
    );
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to generate resume', 'error');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.textContent = 'Generate Resume';
    updateActionButtons();
  }
});

btnDownloadResume.addEventListener('click', async () => {
  if (!lastGeneratedResume?.filePath) {
    showStatus('No generated resume available to download yet.', 'error');
    return;
  }

  const storage = await getStorage();
  if (!storage.token) return;

  hideStatus();
  btnDownloadResume.disabled = true;
  btnDownloadResume.textContent = 'Downloading...';

  try {
    await downloadAuthenticatedFile(
      lastGeneratedResume.filePath,
      storage.token,
      lastGeneratedResume.fileName || 'resume.docx',
    );
    showStatus('Resume downloaded.', 'success');
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to download resume', 'error');
  } finally {
    btnDownloadResume.disabled = false;
    btnDownloadResume.textContent = 'Download Resume';
    updateActionButtons();
  }
});

init();
setupSessionRefresh();
setupJobDetectionListener();
