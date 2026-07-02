import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthScope } from '../hooks/useAuthScope';
import ResumeViewerModal from '../components/ResumeViewerModal';
import DisabledButtonWithTooltip from '../components/DisabledButtonWithTooltip';
import { useToast } from '../components/Toast';
import {
  applicationStatusClass,
  applicationStatusLabel,
} from '../lib/application-status';
import {
  fetchApplicationSummaries,
  fetchJobDetail,
  fetchJobDetails,
  fetchJobSummaries,
  fetchProfileSummary,
  mergeJobWithDetail,
  upsertApplicationInCache,
} from '../lib/app-data-cache';
import {
  extractSkillsForJob,
  generateResumeFromJob,
  getApplicationForJob,
  getGenerateResumeDisabledReason,
  jobSkillsForResume,
  loadUserProfile,
} from '../lib/job-resume';
import {
  applicationBlocksResumeGeneration,
  applicationHasResume,
  applicationIsApplied,
} from '../lib/application-lookup';
import {
  getJobDisplayStatus,
  jobCanExtractSkills,
  jobDisplayStatusBadgeClass,
  jobDisplayStatusLabel,
  jobStatusFilterLabel,
  JobStatusFilter,
  matchesJobDateFilter,
  matchesJobStatusFilter,
  sortJobsByRecordedAt,
} from '../lib/job-filters';
import { profileHasResumeTemplate } from '../lib/profile-template';
import { Application, JobRecord, Profile } from '../types';
import './JobsPage.css';

function isMultiSelectEvent(event: React.MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

function CompanyLogo({
  companyName,
  logoUrl,
  size = 'md',
}: {
  companyName: string;
  logoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <div className={`jobs-company-logo jobs-company-logo-${size}${showLogo ? ' has-logo' : ''}`}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${companyName} logo`}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        companyName.charAt(0).toUpperCase() || '?'
      )}
    </div>
  );
}

function parseSkillList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }
  return value
    .split(/[,;\n&]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSkillLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function SkillTags({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return emptyLabel ? <p className="jobs-empty-inline">{emptyLabel}</p> : null;
  }

  return (
    <div className="jobs-skill-tags">
      {items.map((item) => (
        <span key={item} className="jobs-skill-tag">
          {item}
        </span>
      ))}
    </div>
  );
}

function SkillsView({ skills }: { skills: NonNullable<JobRecord['skills']> }) {
  const textFields = [
    'role',
    'title',
    'title1',
    'title2',
    'title3',
    'title4',
    'companyName',
    'focus',
  ] as const;

  const listFields = ['hardSkills', 'additionalHardSkills', 'competencies'] as const;

  const hasText = textFields.some((key) => {
    const value = skills[key as keyof typeof skills];
    return typeof value === 'string' && value.trim();
  });

  const hasLists = listFields.some(
    (key) => parseSkillList(skills[key as keyof typeof skills]).length,
  );

  if (!hasText && !hasLists) {
    return <p className="jobs-empty-inline">No skills extracted.</p>;
  }

  return (
    <div className="jobs-skills-view">
      {hasText ? (
        <dl className="jobs-skills-fields">
          {textFields.map((key) => {
            const value = skills[key as keyof typeof skills];
            if (typeof value !== 'string' || !value.trim()) return null;
            return (
              <div key={key} className="jobs-skills-field">
                <dt>{formatSkillLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
      {listFields.map((key) => {
        const items = parseSkillList(skills[key as keyof typeof skills]);
        if (!items.length) return null;
        return (
          <div key={key} className="jobs-skills-list-block">
            <span className="jobs-skills-list-label">{formatSkillLabel(key)}</span>
            <SkillTags items={items} emptyLabel="" />
          </div>
        );
      })}
    </div>
  );
}

function profileLabel(profile: Profile): string {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return fullName || profile.profileName;
}

export default function JobsPage() {
  const { userId, token } = useAuthScope();
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionAnchorRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);
  const [jobDetails, setJobDetails] = useState<Record<string, JobRecord>>({});
  const [generating, setGenerating] = useState(false);
  const [extractingSkills, setExtractingSkills] = useState(false);
  const [recordingSkills, setRecordingSkills] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [skillsMessage, setSkillsMessage] = useState('');
  const [error, setError] = useState('');
  const [viewingResume, setViewingResume] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setJobs([]);
    setProfile(null);
    setApplications([]);
    setSelectedJobId(null);
    setSelectedIds(new Set());
    selectionAnchorRef.current = null;
    setJobDetails({});
    setError('');
    setProfileLoading(true);
  }, [userId]);

  const loadPageData = useCallback(
    async (force = false) => {
      if (!token || !userId) {
        setJobs([]);
        setProfile(null);
        setApplications([]);
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      setLoading(true);
      setProfileLoading(true);
      setError('');
      try {
        const [jobSummaries, profileData, applicationsData] = await Promise.all([
          fetchJobSummaries(token),
          fetchProfileSummary(token, userId, { force }),
          fetchApplicationSummaries(token, userId, { force }),
        ]);

        setJobs(jobSummaries);
        setProfile(profileData);
        setApplications(applicationsData);
        setSelectedJobId((current) => current ?? jobSummaries[0]?.id ?? null);
      } catch (err) {
        setJobs([]);
        setProfile(null);
        setApplications([]);
        setError(err instanceof Error ? err.message : 'Failed to load jobs');
      } finally {
        setLoading(false);
        setProfileLoading(false);
      }
    },
    [token, userId],
  );

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      if (query) {
        const haystack = [job.companyName, job.jobTitle, job.linkedInJobId]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      const application = getApplicationForJob(job, applications);
      const displayStatus = getJobDisplayStatus(job, application);
      if (!matchesJobStatusFilter(displayStatus, statusFilter)) return false;
      if (!matchesJobDateFilter(job.createdAt, dateFilter)) return false;

      return true;
    });
  }, [jobs, search, applications, statusFilter, dateFilter]);

  const sortedJobs = useMemo(
    () => sortJobsByRecordedAt(filteredJobs, 'desc'),
    [filteredJobs],
  );

  const sortedJobIds = useMemo(() => sortedJobs.map((job) => job.id), [sortedJobs]);

  useEffect(() => {
    if (selectedJobId && !sortedJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(sortedJobs[0]?.id ?? null);
    }
  }, [sortedJobs, selectedJobId]);

  const selectedJobSummary =
    sortedJobs.find((job) => job.id === selectedJobId) || sortedJobs[0] || null;

  const selectedJob = selectedJobSummary
    ? mergeJobWithDetail(selectedJobSummary, jobDetails[selectedJobSummary.id])
    : null;

  useEffect(() => {
    if (!token || !selectedJobId) {
      return;
    }

    let cancelled = false;
    setJobDetailLoading(true);

    void fetchJobDetail(token, selectedJobId)
      .then((detail) => {
        if (cancelled) return;
        setJobDetails((previous) => ({ ...previous, [detail.id]: detail }));
      })
      .catch(() => {
        // Ignore detail fetch errors; summary data still renders.
      })
      .finally(() => {
        if (!cancelled) {
          setJobDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJobId, token]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    sortedJobs.length > 0 && sortedJobs.every((job) => selectedIds.has(job.id));
  const hasActiveFilters = statusFilter !== 'all' || Boolean(dateFilter);

  const selectedJobs = useMemo(
    () => sortedJobs.filter((job) => selectedIds.has(job.id)),
    [sortedJobs, selectedIds],
  );

  const jobCanGenerateResume = useCallback(
    (job: JobRecord) => {
      const application = getApplicationForJob(job, applications);
      if (applicationBlocksResumeGeneration(application)) return false;
      if (!jobSkillsForResume(job)) return false;
      return (
        getGenerateResumeDisabledReason(profile, {
          profileLoading,
          targetLabel: 'The selected job',
          hasSkills: true,
          hasResume: false,
          isApplied: false,
          generating,
        }) === ''
      );
    },
    [applications, generating, profile, profileLoading],
  );

  const selectedGeneratableJobs = useMemo(
    () => selectedJobs.filter((job) => jobCanGenerateResume(job)),
    [selectedJobs, jobCanGenerateResume],
  );

  const selectedExtractableJobs = useMemo(
    () => selectedJobs.filter((job) => jobCanExtractSkills(job)),
    [selectedJobs],
  );

  const bulkExtractDisabledReason = useMemo(() => {
    if (selectedCount === 0) return 'Select jobs to extract skills.';
    if (selectedExtractableJobs.length === 0) {
      return 'Selected jobs already have skills extracted or no recorded JD.';
    }
    if (!profile && !profileLoading) return 'Profile not loaded.';
    if (extractingSkills) return 'Extracting skills...';
    if (generating) return 'Finish resume generation first.';
    return '';
  }, [
    extractingSkills,
    generating,
    profile,
    profileLoading,
    selectedCount,
    selectedExtractableJobs.length,
  ]);

  const canBulkExtractSkills = bulkExtractDisabledReason === '';

  const bulkGenerateDisabledReason = useMemo(() => {
    if (selectedCount === 0) return 'Select jobs to generate resumes.';
    if (selectedGeneratableJobs.length === 0) {
      return 'Selected jobs already have resumes, are applied, or have no skills.';
    }
    if (!profile && !profileLoading) return 'Profile not loaded.';
    if (profile && !profileHasResumeTemplate(profile)) {
      return 'Upload a resume template in My Profile first.';
    }
    if (profile && !profile.companies.length) {
      return 'Add companies to your profile first.';
    }
    if (generating) return 'Generating resumes...';
    return '';
  }, [
    generating,
    profile,
    profileLoading,
    selectedCount,
    selectedGeneratableJobs.length,
  ]);

  const canBulkGenerate = bulkGenerateDisabledReason === '';

  const handleJobSelect = useCallback(
    (index: number, jobId: string, event: React.MouseEvent) => {
      setSelectedJobId(jobId);

      const id = sortedJobIds[index];
      if (!id) return;

      if (event.shiftKey && selectionAnchorRef.current !== null) {
        const start = Math.min(selectionAnchorRef.current, index);
        const end = Math.max(selectionAnchorRef.current, index);
        const rangeIds = sortedJobIds.slice(start, end + 1);

        setSelectedIds((previous) => {
          const next = isMultiSelectEvent(event) ? new Set(previous) : new Set<string>();
          rangeIds.forEach((rangeId) => next.add(rangeId));
          return next;
        });
        return;
      }

      if (isMultiSelectEvent(event)) {
        setSelectedIds((previous) => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        selectionAnchorRef.current = index;
        return;
      }

      setSelectedIds(new Set([id]));
      selectionAnchorRef.current = index;
    },
    [sortedJobIds],
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((previous) => {
        const next = new Set(previous);
        sortedJobIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelectedIds((previous) => {
      const next = new Set(previous);
      sortedJobIds.forEach((id) => next.add(id));
      return next;
    });
    selectionAnchorRef.current = 0;
  };

  const clearAllFilters = () => {
    setStatusFilter('all');
    setDateFilter('');
  };

  const handleBulkExtractSkills = async () => {
    if (!token || !canBulkExtractSkills || !profile) {
      if (bulkExtractDisabledReason) {
        showToast(bulkExtractDisabledReason, 'error');
      }
      return;
    }

    setExtractingSkills(true);
    setSkillsMessage('');
    try {
      const jobsToExtract = await fetchJobDetails(
        token,
        selectedExtractableJobs.map((job) => job.id),
      );
      const jobsById = new Map(jobsToExtract.map((job) => [job.id, job]));
      let successCount = 0;

      for (let index = 0; index < selectedExtractableJobs.length; index += 1) {
        const summary = selectedExtractableJobs[index];
        const job = jobsById.get(summary.id) ?? summary;
        setSkillsMessage(
          `Extracting skills ${index + 1} of ${selectedExtractableJobs.length}: ${job.jobTitle || 'Untitled role'}...`,
        );

        const result = await extractSkillsForJob(job, token, profile.id, (message) => {
          setSkillsMessage(
            `Extracting skills ${index + 1} of ${selectedExtractableJobs.length}: ${message}`,
          );
        });

        if (userId) {
          upsertApplicationInCache(result.application, userId);
        }
        setApplications((previous) => {
          const others = previous.filter((app) => app.id !== result.application.id);
          return [result.application, ...others];
        });
        setJobs((previous) =>
          previous.map((entry) =>
            entry.id === result.job.id
              ? {
                  ...entry,
                  ...result.job,
                  jobDescription: undefined,
                  skills: undefined,
                  hasSkills: true,
                  hasJobDescription: true,
                }
              : entry,
          ),
        );
        setJobDetails((previous) => ({ ...previous, [result.job.id]: result.job }));
        successCount += 1;
      }

      showToast(
        `Extracted skills for ${successCount} job${successCount !== 1 ? 's' : ''}.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to extract skills', 'error');
    } finally {
      setExtractingSkills(false);
      setSkillsMessage('');
    }
  };

  const handleBulkGenerateResume = async () => {
    if (!token || !canBulkGenerate) {
      if (bulkGenerateDisabledReason) {
        showToast(bulkGenerateDisabledReason, 'error');
      }
      return;
    }

    setGenerating(true);
    setGenerateMessage('');
    try {
      const freshProfile = await loadUserProfile(token);
      setProfile(freshProfile);

      if (!profileHasResumeTemplate(freshProfile)) {
        throw new Error('Upload a resume template in My Profile first.');
      }
      if (!freshProfile.companies.length) {
        throw new Error('Add companies to your profile before generating resumes.');
      }

      const jobsToGenerate = await fetchJobDetails(
        token,
        selectedGeneratableJobs.map((job) => job.id),
      );
      const jobsById = new Map(jobsToGenerate.map((job) => [job.id, job]));
      let successCount = 0;

      for (let index = 0; index < selectedGeneratableJobs.length; index++) {
        const summary = selectedGeneratableJobs[index];
        const job = jobsById.get(summary.id) ?? summary;
        setGenerateMessage(
          `Generating resume ${index + 1} of ${selectedGeneratableJobs.length}: ${job.jobTitle || 'Untitled role'}...`,
        );

        const result = await generateResumeFromJob(
          job,
          freshProfile,
          token,
          (message) => {
            setGenerateMessage(
              `Generating resume ${index + 1} of ${selectedGeneratableJobs.length}: ${message}`,
            );
          },
        );

        if (userId) {
          upsertApplicationInCache(result.application, userId);
        }
        setApplications((previous) => {
          const others = previous.filter((app) => app.id !== result.application.id);
          return [result.application, ...others];
        });
        successCount += 1;
      }

      showToast(
        `Generated ${successCount} resume${successCount !== 1 ? 's' : ''} and saved to your applications.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate resumes', 'error');
    } finally {
      setGenerating(false);
      setGenerateMessage('');
    }
  };

  const selectedApplication = useMemo(() => {
    if (!selectedJob) return null;
    return getApplicationForJob(selectedJob, applications);
  }, [selectedJob, applications]);

  const selectedHasResume = applicationHasResume(selectedApplication);
  const selectedIsApplied = applicationIsApplied(selectedApplication);
  const hasResumeTemplate = profileHasResumeTemplate(profile);

  const generateResumeDisabledReason = !selectedJob
    ? 'Select a job first.'
    : getGenerateResumeDisabledReason(profile, {
        profileLoading,
        targetLabel: 'This job',
        hasSkills: Boolean(jobSkillsForResume(selectedJob)),
        hasResume: selectedHasResume,
        isApplied: selectedIsApplied,
        generating,
      });

  const canGenerateResume = generateResumeDisabledReason === '';
  const showGenerateResumeButton = !applicationBlocksResumeGeneration(selectedApplication);

  const handleGenerateResume = async () => {
    if (!token || !selectedJob || !canGenerateResume) {
      if (generateResumeDisabledReason) {
        showToast(generateResumeDisabledReason, 'error');
      }
      return;
    }

    setGenerating(true);
    setGenerateMessage('');
    try {
      const [freshProfile, fullJob] = await Promise.all([
        loadUserProfile(token),
        fetchJobDetail(token, selectedJob.id),
      ]);
      setProfile(freshProfile);
      setJobDetails((previous) => ({ ...previous, [fullJob.id]: fullJob }));

      if (!profileHasResumeTemplate(freshProfile)) {
        throw new Error('Upload a resume template in My Profile first.');
      }
      if (!freshProfile.companies.length) {
        throw new Error('Add companies to your profile before generating a resume.');
      }
      if (!jobSkillsForResume(fullJob)) {
        throw new Error('This job has no extracted skills yet.');
      }

      const result = await generateResumeFromJob(
        fullJob,
        freshProfile,
        token,
        setGenerateMessage,
      );

      if (userId) {
        upsertApplicationInCache(result.application, userId);
      }
      setApplications((previous) => {
        const others = previous.filter((app) => app.id !== result.application.id);
        return [result.application, ...others];
      });

      showToast('Resume generated and saved to your applications.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate resume', 'error');
    } finally {
      setGenerating(false);
      setGenerateMessage('');
    }
  };

  const handleExtractSkills = async () => {
    if (!token || !selectedJob || !profile) {
      return;
    }

    setRecordingSkills(true);
    try {
      const fullJob = await fetchJobDetail(token, selectedJob.id);
      setJobDetails((previous) => ({ ...previous, [fullJob.id]: fullJob }));

      const result = await extractSkillsForJob(fullJob, token, profile.id);
      if (userId) {
        upsertApplicationInCache(result.application, userId);
      }
      setApplications((previous) => {
        const others = previous.filter((app) => app.id !== result.application.id);
        return [result.application, ...others];
      });
      setJobs((previous) =>
        previous.map((entry) =>
          entry.id === result.job.id
            ? {
                ...entry,
                ...result.job,
                jobDescription: undefined,
                skills: undefined,
                hasSkills: true,
                hasJobDescription: true,
              }
            : entry,
        ),
      );
      setJobDetails((previous) => ({ ...previous, [result.job.id]: result.job }));
      showToast('Skills extracted and recorded in your Applications.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to extract skills',
        'error',
      );
    } finally {
      setRecordingSkills(false);
    }
  };

  const getJobApplication = (job: JobRecord) => getApplicationForJob(job, applications);
  const selectedDisplayStatus = selectedJob
    ? getJobDisplayStatus(selectedJob, selectedApplication)
    : null;

  return (
    <div className="jobs-page">
      <div className="page-header">
        <div>
          <h1>Shared Jobs</h1>
          <p>Browse jobs recorded by anyone in the system to save extraction time</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void loadPageData(true)}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading">Loading jobs...</div>
      ) : (
        <div className="jobs-layout">
          <aside className="jobs-list-panel">
            <section className="jobs-filters" aria-label="Filter jobs">
              <div className="jobs-filters-grid">
                <div className="control-group control-group-wide">
                  <span className="control-group-label">Status</span>
                  <div
                    className="segmented-control"
                    role="tablist"
                    aria-label="Your activity status"
                  >
                    {(
                      [
                        'all',
                        'jd_recorded_only',
                        'skills_extracted',
                        'resume_generated',
                        'applied',
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === filter}
                        className={`segmented-control-btn${statusFilter === filter ? ' active' : ''}`}
                        onClick={() => setStatusFilter(filter)}
                      >
                        {jobStatusFilterLabel(filter)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group">
                  <span className="control-group-label">Recorded date</span>
                  <div className="control-field-row">
                    <input
                      type="date"
                      className="control-input"
                      value={dateFilter}
                      onChange={(event) => setDateFilter(event.target.value)}
                      aria-label="Filter by recorded date"
                    />
                    {dateFilter ? (
                      <button
                        type="button"
                        className="control-clear-btn"
                        onClick={() => setDateFilter('')}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {hasActiveFilters ? (
                <div className="jobs-active-filters">
                  <span className="jobs-active-filters-label">Active filters</span>
                  <div className="jobs-active-filter-chips">
                    {statusFilter !== 'all' ? (
                      <span className="active-filter-chip">
                        Status: {jobStatusFilterLabel(statusFilter)}
                      </span>
                    ) : null}
                    {dateFilter ? (
                      <span className="active-filter-chip">
                        Recorded on{' '}
                        {new Date(`${dateFilter}T12:00:00`).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    ) : null}
                  </div>
                  <button type="button" className="control-clear-btn" onClick={clearAllFilters}>
                    Clear all
                  </button>
                </div>
              ) : null}
            </section>

            <input
              type="search"
              className="jobs-search"
              placeholder="Search company, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="jobs-summary">
              <label className="jobs-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  disabled={sortedJobs.length === 0}
                />
                <span>
                  {sortedJobs.length} job{sortedJobs.length !== 1 ? 's' : ''}
                </span>
              </label>
              {selectedCount > 0 ? (
                <span className="selection-summary">{selectedCount} selected</span>
              ) : null}
              <div className="jobs-summary-actions">
                <DisabledButtonWithTooltip
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={extractingSkills || !canBulkExtractSkills}
                  disabledReason={
                    !extractingSkills && bulkExtractDisabledReason
                      ? bulkExtractDisabledReason
                      : undefined
                  }
                  onClick={() => void handleBulkExtractSkills()}
                >
                  {extractingSkills
                    ? 'Extracting...'
                    : selectedCount > 1
                      ? `Extract Skills (${selectedExtractableJobs.length})`
                      : 'Extract Skills'}
                </DisabledButtonWithTooltip>
                <DisabledButtonWithTooltip
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={generating || !canBulkGenerate}
                  disabledReason={
                    !generating && bulkGenerateDisabledReason
                      ? bulkGenerateDisabledReason
                      : undefined
                  }
                  onClick={() => void handleBulkGenerateResume()}
                >
                  {generating
                    ? 'Generating...'
                    : selectedCount > 1
                      ? `Generate ${selectedGeneratableJobs.length} Resumes`
                      : 'Generate Resume'}
                </DisabledButtonWithTooltip>
              </div>
            </div>

            {skillsMessage ? (
              <p className="jobs-generate-status jobs-list-generate-status">{skillsMessage}</p>
            ) : null}

            {generating && generateMessage ? (
              <p className="jobs-generate-status jobs-list-generate-status">{generateMessage}</p>
            ) : null}

            <p className="jobs-selection-hint">
              Click to select. Ctrl/Cmd+click for multi-select. Shift+click for a range.
            </p>

            <div className="jobs-list">
              {sortedJobs.map((job, index) => {
                const application = getJobApplication(job);
                const displayStatus = getJobDisplayStatus(job, application);
                const isSelected = selectedIds.has(job.id);
                const isActive = selectedJob?.id === job.id;

                return (
                  <div
                    key={job.id}
                    className={`jobs-list-item${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                    onClick={(event) => handleJobSelect(index, job.id, event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleJobSelect(index, job.id, event as unknown as React.MouseEvent);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="jobs-list-item-row">
                      <input
                        type="checkbox"
                        className="jobs-select-checkbox"
                        checked={isSelected}
                        readOnly
                        aria-label={`Select ${job.companyName || 'job'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleJobSelect(index, job.id, event);
                        }}
                      />
                      <CompanyLogo
                        companyName={job.companyName || 'Unknown'}
                        logoUrl={job.companyLogoUrl}
                        size="sm"
                      />
                      <div className="jobs-list-item-text">
                        <strong>{job.companyName || 'Unknown company'}</strong>
                        <span>{job.jobTitle || 'Untitled role'}</span>
                      </div>
                    </div>
                    <div className="jobs-list-item-status">
                      <span className={`badge ${jobDisplayStatusBadgeClass(displayStatus)}`}>
                        {jobDisplayStatusLabel(displayStatus)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!sortedJobs.length && <p className="jobs-empty">No jobs found.</p>}
            </div>
          </aside>

          <section className="jobs-detail-panel">
            {selectedJob ? (
              <>
                <header className="jobs-detail-header">
                  <CompanyLogo
                    companyName={selectedJob.companyName || 'Unknown'}
                    logoUrl={selectedJob.companyLogoUrl}
                    size="lg"
                  />
                  <div className="jobs-detail-header-text">
                    {selectedJob.realJobUrl ? (
                      <a
                        href={selectedJob.realJobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="jobs-detail-title-link"
                      >
                        {selectedJob.jobTitle || 'Untitled role'}
                      </a>
                    ) : (
                      <h2>{selectedJob.jobTitle || 'Untitled role'}</h2>
                    )}
                    <p className="jobs-meta">{selectedJob.companyName || 'Unknown company'}</p>
                    <SkillTags items={selectedJob.hardSkills} emptyLabel="" />
                    <div className="jobs-detail-actions">
                      {showGenerateResumeButton ? (
                        <DisabledButtonWithTooltip
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={generating || !canGenerateResume}
                          disabledReason={
                            !generating && generateResumeDisabledReason
                              ? generateResumeDisabledReason
                              : undefined
                          }
                          onClick={() => void handleGenerateResume()}
                        >
                          {generating ? 'Generating...' : 'Generate Resume'}
                        </DisabledButtonWithTooltip>
                      ) : null}
                      {selectedApplication?.resumeUrl ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setViewingResume({
                              url: selectedApplication.resumeUrl!,
                              title: `${selectedJob.jobTitle} at ${selectedJob.companyName}`,
                            })
                          }
                        >
                          View Resume
                        </button>
                      ) : null}
                    </div>
                    {generating && generateMessage ? (
                      <p className="jobs-generate-status">{generateMessage}</p>
                    ) : null}
                  </div>
                </header>

                <div className="jobs-application-status card">
                  <h3>Your Application</h3>
                  {profile ? (
                    <p className="jobs-empty-inline">Profile: {profileLabel(profile)}</p>
                  ) : null}
                  {!selectedApplication ? (
                    <>
                      <p className="jobs-empty-inline">
                        {selectedDisplayStatus === 'jd_recorded_only'
                          ? 'Job description recorded. Extract skills to add this job to your Applications.'
                          : 'Skills extracted for this job. Generate a resume to add it to your Applications.'}
                      </p>
                      {selectedJob && jobCanExtractSkills(selectedJob) ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={recordingSkills || profileLoading || extractingSkills}
                          onClick={() => void handleExtractSkills()}
                        >
                          {recordingSkills ? 'Extracting...' : 'Extract Skills'}
                        </button>
                      ) : null}
                    </>
                  ) : selectedIsApplied ? (
                    <div className="jobs-application-status-body">
                      <span className={`badge ${applicationStatusClass('applied')}`}>Applied</span>
                      <p className="jobs-application-status-note">
                        You already applied to this job. It is recorded in your Applications page.
                      </p>
                      {selectedApplication.appliedAt ? (
                        <p className="jobs-application-status-meta">
                          Applied {new Date(selectedApplication.appliedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                  ) : selectedHasResume ? (
                    <div className="jobs-application-status-body">
                      <span className={`badge ${applicationStatusClass('resume_generated')}`}>
                        Resume generated
                      </span>
                      <p className="jobs-application-status-note">
                        A resume is already generated and recorded in your Applications page.
                      </p>
                      <p className="jobs-application-status-meta">
                        Recorded {new Date(selectedApplication.createdAt).toLocaleString()}
                        {selectedApplication.updatedAt !== selectedApplication.createdAt
                          ? ` · Updated ${new Date(selectedApplication.updatedAt).toLocaleString()}`
                          : ''}
                      </p>
                    </div>
                  ) : (
                    <div className="jobs-application-status-body">
                      <span
                        className={`badge ${applicationStatusClass(selectedApplication.status)}`}
                      >
                        {selectedApplication.resumeUrl
                          ? 'Resume generated'
                          : applicationStatusLabel(selectedApplication.status)}
                      </span>
                      <p className="jobs-application-status-meta">
                        Recorded {new Date(selectedApplication.createdAt).toLocaleString()}
                        {selectedApplication.updatedAt !== selectedApplication.createdAt
                          ? ` · Updated ${new Date(selectedApplication.updatedAt).toLocaleString()}`
                          : ''}
                      </p>
                      {selectedApplication.resumeUrl ? (
                        <p className="jobs-application-status-note">
                          This job is linked to your application and resume in the Applications
                          page.
                        </p>
                      ) : (
                        <p className="jobs-application-status-note">
                          Skills extracted. Generate a resume when you are ready.
                        </p>
                      )}
                    </div>
                  )}
                  {profile && !hasResumeTemplate ? (
                    <p className="jobs-profile-warning">
                      Upload a resume template in My Profile before generating a resume.
                    </p>
                  ) : null}
                  {profile && !profile.companies.length ? (
                    <p className="jobs-profile-warning">
                      Add companies to your profile before generating a resume.
                    </p>
                  ) : null}
                  {selectedJob && !jobSkillsForResume(selectedJob) ? (
                    <p className="jobs-profile-warning">
                      This job has no extracted skills yet, so a resume cannot be generated.
                    </p>
                  ) : null}
                </div>

                <div className="jobs-detail-body">
                  {jobDetailLoading && !selectedJob.jobDescription ? (
                    <p className="jobs-empty-inline">Loading job details...</p>
                  ) : null}
                  <div className="jobs-section jobs-jd-section">
                    <h3>Job Description</h3>
                    <div className="jobs-jd-scroll">
                      <pre className="jobs-jd">
                        {selectedJob.jobDescription || 'No description stored.'}
                      </pre>
                    </div>
                  </div>

                  <div className="jobs-section jobs-skills-section">
                    <h3>Skills</h3>
                    <div className="jobs-skills-scroll">
                      {selectedJob.skills ? (
                        <SkillsView skills={selectedJob.skills} />
                      ) : (
                        <p className="jobs-empty-inline">No skills extracted.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="jobs-empty">Select a job to view details.</p>
            )}
          </section>
        </div>
      )}

      {viewingResume && token ? (
        <ResumeViewerModal
          resumeUrl={viewingResume.url}
          title={viewingResume.title}
          token={token}
          onClose={() => setViewingResume(null)}
        />
      ) : null}
    </div>
  );
}
