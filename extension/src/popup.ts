import {
  getStorage,
  setStorage,
  clearStorage,
  signOut,
  openLoginPage,
  openSignUpPage,
  apiRequest,
  ensureAuthenticatedSession,
} from './shared';
import { bindBulletTextarea, formatBulletLines, BULLET_LINE_PREFIX, stripBulletLinePrefix } from './bullet-format';
import {
  getProfileSetupWarnings,
  profileHasTemplate as profileHasResumeTemplate,
} from './profile-status';
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
  resumeTemplateFormat?: 'text' | 'docx' | '';
  resumeTemplateFilePath?: string;
  companies?: ProfileCompany[];
}

interface GenerateCompanyBulletsResponse {
  company: string;
  bullets: string[];
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

interface SavedApplication {
  id: string;
  hardSkills: string[];
  competencies: string[];
  skills?: ApplicationSkills;
}

const authSection = document.getElementById('auth-section')!;
const mainSection = document.getElementById('main-section')!;
const userEmail = document.getElementById('user-email')!;
const userAvatar = document.getElementById('user-avatar')!;
const profileSummary = document.getElementById('profile-summary')!;
const profileSetupWarnings = document.getElementById('profile-setup-warnings')!;
const noJob = document.getElementById('no-job')!;
const jobPanel = document.getElementById('job-panel')!;
const jobTitle = document.getElementById('job-title')!;
const jobCompany = document.getElementById('job-company')!;
const companyAvatar = document.getElementById('company-avatar')!;
const jobSkills = document.getElementById('job-skills')!;
const jdText = document.getElementById('jd-text') as HTMLTextAreaElement;
const skillsText = document.getElementById('skills-text') as HTMLTextAreaElement;
const btnRefreshJd = document.getElementById('btn-refresh-jd') as HTMLButtonElement;
const btnRefreshJdEmpty = document.getElementById('btn-refresh-jd-empty') as HTMLButtonElement;
const btnExtractSkills = document.getElementById('btn-extract-skills') as HTMLButtonElement;
const btnSave = document.getElementById('btn-save') as HTMLButtonElement;
const btnGenerate = document.getElementById('btn-generate') as HTMLButtonElement;
const companyBulletsSection = document.getElementById('company-bullets-section')!;
const companyBulletsList = document.getElementById('company-bullets-list')!;
const statusEl = document.getElementById('status')!;

let currentJob: ExtractedJob | null = null;
let extractedSkills: ApplicationSkills | null = null;
let lastApplicationId: string | null = null;
let currentProfile: Profile | null = null;

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
}

function parseSkillString(value?: string): string[] {
  if (!value?.trim()) return [];
  return value.split('&').map((item) => item.trim()).filter(Boolean);
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
    skills.hardSkills ||
      skills.competencies ||
      skills.title ||
      skills.focus,
  );
}

function displaySkillsJson(skills: ApplicationSkills) {
  extractedSkills = skills;
  skillsText.value = JSON.stringify(skills, null, 2);

  const tags = [
    ...parseSkillString(skills.hardSkills),
    ...parseSkillString(skills.additionalHardSkills),
    ...parseSkillString(skills.competencies).slice(0, 4),
  ];
  displaySkillTags([...new Set(tags)]);
}

function clearSkillsField() {
  extractedSkills = null;
  skillsText.value = '';
  jobSkills.innerHTML = '';
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
  return currentProfile ?? undefined;
}

function updateProfileSummary() {
  if (!currentProfile) {
    profileSummary.textContent = 'Loading profile...';
    profileSummary.className = 'field-hint';
    profileSetupWarnings.classList.add('hidden');
    profileSetupWarnings.textContent = '';
    return;
  }

  profileSummary.textContent = 'Profile loaded successfully.';
  profileSummary.className = 'field-hint profile-status-ok';

  const warnings = getProfileSetupWarnings(currentProfile);
  if (warnings.length) {
    profileSetupWarnings.textContent = warnings.join(' ');
    profileSetupWarnings.classList.remove('hidden');
  } else {
    profileSetupWarnings.textContent = '';
    profileSetupWarnings.classList.add('hidden');
  }
}

function profileHasTemplate(): boolean {
  return profileHasResumeTemplate(getSelectedProfile());
}

function allCompanyBulletsFilled(): boolean {
  const companies = getSelectedCompanies();
  if (companies.length === 0) return false;

  return companies.every((_, index) => {
    const textarea = companyBulletsList.querySelector<HTMLTextAreaElement>(
      `textarea[data-company-index="${index}"]`,
    );
    const text = textarea?.value.trim() || '';
    if (!text) return false;

    return text
      .split('\n')
      .some((line) => stripBulletLinePrefix(line).length > 0);
  });
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

function updateGenerateResumeVisibility(): void {
  const shouldShow =
    Boolean(currentProfile) &&
    getSelectedCompanies().length > 0 &&
    profileHasTemplate();

  btnGenerate.classList.toggle('hidden', !shouldShow);
}

function getSelectedCompanies(): ProfileCompany[] {
  return normalizeCompanies(getSelectedProfile()?.companies);
}

function renderCompanyBulletFields() {
  const companies = getSelectedCompanies();

  companyBulletsList.innerHTML = '';
  companyBulletsSection.classList.toggle('hidden', companies.length === 0);

  companies.forEach((company, index) => {
    const item = document.createElement('div');
    item.className = 'company-bullet-item';

    const header = document.createElement('div');
    header.className = 'company-bullet-header';

    const label = document.createElement('span');
    label.className = 'company-bullet-label';
    label.textContent = company.name;

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

    const generateBtn = document.createElement('button');
    generateBtn.type = 'button';
    generateBtn.className = 'btn btn-secondary btn-generate-company';
    generateBtn.textContent = 'Generate';
    generateBtn.dataset.companyIndex = String(index);
    generateBtn.disabled = !hasSkillsContent(extractedSkills);
    generateBtn.addEventListener('click', () => {
      void generateCompanyBullets(index);
    });

    controls.appendChild(countInput);
    controls.appendChild(generateBtn);

    header.appendChild(label);
    header.appendChild(controls);

    const textarea = document.createElement('textarea');
    textarea.className = 'field-textarea company-bullet-text';
    textarea.rows = 4;
    textarea.dataset.companyIndex = String(index);
    textarea.placeholder = `One bullet per line, e.g. ${BULLET_LINE_PREFIX}Achievement...`;
    bindBulletTextarea(textarea, updateActionButtons);

    item.appendChild(header);
    item.appendChild(textarea);
    companyBulletsList.appendChild(item);
  });

  updateActionButtons();
}

async function generateCompanyBullets(companyIndex: number) {
  const profile = getSelectedProfile();
  const companies = getSelectedCompanies();
  const company = companies[companyIndex];
  if (!profile || !company || !extractedSkills) return;

  const storage = await getStorage();
  if (!storage.token) return;

  const countInput = companyBulletsList.querySelector<HTMLInputElement>(
    `input.company-bullet-count[data-company-index="${companyIndex}"]`,
  );
  const textarea = companyBulletsList.querySelector<HTMLTextAreaElement>(
    `textarea[data-company-index="${companyIndex}"]`,
  );
  const generateBtn = companyBulletsList.querySelector<HTMLButtonElement>(
    `button.btn-generate-company[data-company-index="${companyIndex}"]`,
  );

  const bulletCount = Math.max(1, Number(countInput?.value) || company.bulletCount || 1);
  const jobData = getJobData(jdText.value.trim());

  hideStatus();
  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = '...';
  }

  try {
    const response = await apiRequest<GenerateCompanyBulletsResponse>(
      '/resumes/generate-bullets',
      {
        method: 'POST',
        token: storage.token,
        body: JSON.stringify({
          profileId: profile.id,
          companyName: company.name,
          skills: extractedSkills,
          bulletCount,
          jobDescription: jdText.value.trim() || undefined,
          targetJobCompany: jobData.companyName,
          targetJobTitle: jobData.jobTitle,
        }),
      },
    );

    if (textarea) {
      textarea.value = formatBulletLines(response.bullets.filter(Boolean).join('\n'));
    }

    const filledCount = response.bullets.filter((bullet) => bullet.trim()).length;
    showStatus(
      filledCount > 0
        ? `Generated ${filledCount} bullet${filledCount === 1 ? '' : 's'} for ${company.name}.`
        : `No bullets generated for ${company.name}.`,
      filledCount > 0 ? 'success' : 'info',
    );
  } catch (err) {
    showStatus(
      err instanceof Error ? err.message : `Failed to generate bullets for ${company.name}`,
      'error',
    );
  } finally {
    if (generateBtn) {
      generateBtn.disabled = !hasSkillsContent(extractedSkills);
      generateBtn.textContent = 'Generate';
    }
    updateActionButtons();
  }
}

function updateActionButtons() {
  const hasJd = jdText.value.trim().length > 0;
  const hasSkills = hasSkillsContent(extractedSkills);

  btnExtractSkills.disabled = !hasJd;
  btnSave.disabled = !hasJd || !currentProfile;
  updateGenerateResumeVisibility();
  btnGenerate.disabled =
    !currentProfile ||
    !hasSkills ||
    !allCompanyBulletsFilled() ||
    !profileHasTemplate();

  companyBulletsList.querySelectorAll<HTMLButtonElement>('button.btn-generate-company').forEach((btn) => {
    btn.disabled = !hasSkills;
  });
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
  currentJob = job;
  jobTitle.textContent = job.jobTitle;
  jobCompany.textContent = [job.companyName, job.location].filter(Boolean).join(' · ');
  setCompanyAvatar(job.companyLogoUrl, job.companyName);
  jdText.value = job.jobDescription;
  clearSkillsField();

  jobPanel.classList.remove('hidden');
  noJob.classList.add('hidden');
  updateActionButtons();
}

function clearJobDisplay() {
  currentJob = null;
  clearSkillsField();
  companyAvatar.innerHTML = '?';
  companyAvatar.classList.remove('has-logo');
  jobPanel.classList.add('hidden');
  noJob.classList.remove('hidden');
  updateActionButtons();
}

function getJobData(description: string) {
  return currentJob || {
    companyName: jobCompany.textContent?.split(' · ')[0] || 'Unknown',
    jobTitle: jobTitle.textContent || 'Unknown',
    jobDescription: description,
    hardSkills: [],
    competencies: [],
    location: '',
    jobUrl: '',
    companyLogoUrl: undefined,
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
  const description = jdText.value.trim();
  if (!description) return;

  const storage = await getStorage();
  if (!storage.token) return;

  const jobData = getJobData(description);

  hideStatus();
  btnExtractSkills.disabled = true;
  btnExtractSkills.textContent = 'Extracting...';

  try {
    const response = await apiRequest<{
      skills: ApplicationSkills;
      costUsd?: number;
    }>('/applications/extract-skills', {
      method: 'POST',
      token: storage.token,
      body: JSON.stringify({
        jobDescription: description,
        companyName: jobData.companyName,
        jobTitle: jobData.jobTitle,
        linkedInJobUrl: jobData.linkedInJobUrl || jobData.jobUrl,
        realJobUrl: jobData.realJobUrl || '',
        location: jobData.location,
        companyLogoUrl: jobData.companyLogoUrl,
        applicationId: lastApplicationId || undefined,
        linkedInJobId: currentJob?.linkedInJobId || undefined,
      }),
    });

    displaySkillsJson(response.skills);

    if (!hasSkillsContent(response.skills)) {
      showStatus(
        'AI returned no skills. Check OPENAI_API_KEY in the API .env and restart the server.',
        'info',
      );
    } else {
      const parts = ['Skills extracted.'];
      if (response.skills.title) parts.push(`Title: ${response.skills.title}.`);
      if (response.skills.focus) parts.push(`Focus: ${response.skills.focus}.`);
      showStatus(parts.join(' '), 'success');
    }
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to extract skills', 'error');
  } finally {
    btnExtractSkills.disabled = false;
    btnExtractSkills.textContent = 'Extract Skills';
    updateActionButtons();
  }
}

async function loadProfile(token: string, options?: { notify?: boolean }) {
  try {
    currentProfile = await apiRequest<Profile>('/profiles/me', { token });
    updateProfileSummary();
    renderCompanyBulletFields();
    updateActionButtons();

    if (options?.notify) {
      showStatus('Profile loaded.', 'success');
    }
  } catch (err) {
    currentProfile = null;
    updateProfileSummary();
    showStatus(
      err instanceof Error ? err.message : 'Could not load profile. Is the API running?',
      'error',
    );
  }
}

let authSessionGeneration = 0;
let authRefreshTimer: ReturnType<typeof setTimeout> | null = null;

async function refreshAuthUI(fullInit = false) {
  const generation = ++authSessionGeneration;
  hideStatus();

  const auth = await ensureAuthenticatedSession();
  if (generation !== authSessionGeneration) return;

  if (!auth?.token) {
    showAuthUI();
    return;
  }

  showMainUI(auth.email || '');

  if (!fullInit) return;

  await loadProfile(auth.token);
  await extractJobFromTab();

  const storage = await getStorage();
  lastApplicationId = storage.lastApplicationId || null;

  if (lastApplicationId) {
    updateGenerateResumeVisibility();
    updateActionButtons();
  }
}

function scheduleAuthRefresh(fullInit = false) {
  if (authRefreshTimer) {
    clearTimeout(authRefreshTimer);
  }

  authRefreshTimer = setTimeout(() => {
    authRefreshTimer = null;
    void refreshAuthUI(fullInit);
  }, fullInit ? 0 : 200);
}

async function init() {
  await refreshAuthUI(true);
}

function setupSessionRefresh() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleAuthRefresh(false);
    }
  });

  window.addEventListener('focus', () => {
    scheduleAuthRefresh(false);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes.signedOut?.newValue === true) {
      authSessionGeneration += 1;
      showAuthUI();
      return;
    }

    if (changes.token && !changes.token.newValue) {
      authSessionGeneration += 1;
      showAuthUI();
      return;
    }

    if (changes.token?.newValue || changes.email?.newValue) {
      scheduleAuthRefresh(false);
    }
  });
}

document.getElementById('btn-signin')!.addEventListener('click', () => {
  openLoginPage();
});

document.getElementById('btn-signup')!.addEventListener('click', () => {
  openSignUpPage();
});

document.getElementById('btn-signout')!.addEventListener('click', async () => {
  authSessionGeneration += 1;
  await signOut();
  currentProfile = null;
  currentJob = null;
  extractedSkills = null;
  showAuthUI();
});

jdText.addEventListener('input', () => {
  if (currentJob) {
    currentJob = { ...currentJob, jobDescription: jdText.value };
  }
  clearSkillsField();
  updateActionButtons();
});

const refreshJobDescription = () => extractJobFromTab(true);
btnRefreshJd.addEventListener('click', refreshJobDescription);
btnRefreshJdEmpty.addEventListener('click', refreshJobDescription);
btnExtractSkills.addEventListener('click', extractSkillsFromApi);

btnSave.addEventListener('click', async () => {
  const description = jdText.value.trim();
  if (!description || !currentProfile) return;

  const storage = await getStorage();
  if (!storage.token) return;

  hideStatus();
  btnSave.disabled = true;
  btnSave.textContent = 'Saving...';

  const jobData = getJobData(description);

  try {
    const application = await apiRequest<SavedApplication>('/applications', {
      method: 'POST',
      token: storage.token,
      body: JSON.stringify({
        companyName: jobData.companyName,
        jobTitle: jobData.jobTitle,
        jobDescription: description,
        jobUrl: jobData.jobUrl,
        location: jobData.location,
        companyLogoUrl: jobData.companyLogoUrl,
        skipSkillExtraction: Boolean(extractedSkills),
        skills: extractedSkills || undefined,
      }),
    });

    lastApplicationId = application.id;
    await setStorage({ lastApplicationId: application.id });

    if (application.skills) {
      displaySkillsJson(application.skills);
    }

    showStatus('Application saved.', 'success');
    updateGenerateResumeVisibility();
    updateActionButtons();
  } catch (err) {
    showStatus(err instanceof Error ? err.message : 'Failed to save', 'error');
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = 'Save Application';
    updateActionButtons();
  }
});

btnGenerate.addEventListener('click', async () => {
  if (!currentProfile || !extractedSkills) return;

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

  const companyBullets = collectAllCompanyBullets();

  hideStatus();
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Generating...';

  try {
    let applicationId = lastApplicationId;
    if (!applicationId) {
      const description = jdText.value.trim();
      const jobData = getJobData(description);
      const application = await apiRequest<SavedApplication>('/applications', {
        method: 'POST',
        token: storage.token,
        body: JSON.stringify({
          companyName: jobData.companyName,
          jobTitle: jobData.jobTitle,
          jobDescription: description,
          jobUrl: jobData.jobUrl,
          location: jobData.location,
          companyLogoUrl: jobData.companyLogoUrl,
          skipSkillExtraction: Boolean(extractedSkills),
          skills: extractedSkills || undefined,
        }),
      });
      lastApplicationId = application.id;
      applicationId = application.id;
      await setStorage({ lastApplicationId: application.id });
    }

    const resume = await apiRequest<{ content?: string; fileUrl?: string; fileName?: string }>(
      '/resumes/generate',
      {
        method: 'POST',
        token: storage.token,
        body: JSON.stringify({
          applicationId,
          skills: extractedSkills,
          companyBullets,
        }),
      },
    );

    showStatus(
      resume.fileUrl
        ? 'Resume generated from template and saved on the server.'
        : 'Resume generated from template successfully.',
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

init();
setupSessionRefresh();
