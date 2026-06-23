import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthScope } from '../hooks/useAuthScope';
import ResumeViewerModal from '../components/ResumeViewerModal';
import DisabledButtonWithTooltip from '../components/DisabledButtonWithTooltip';
import { useToast } from '../components/Toast';
import { exportSelectedApplications } from '../lib/application-export';
import {
  applicationHasResume,
  applicationCanMarkApplied,
  applicationIsApplied,
} from '../lib/application-lookup';
import {
  applicationHasExtractedSkills,
  generateResumeFromApplication,
  getGenerateResumeDisabledReason,
  loadUserProfile,
} from '../lib/job-resume';
import {
  ApplicationDateField,
  matchesApplicationDateFilter,
} from '../lib/application-filters';
import {
  ApplicationSortField,
  sortApplications,
  sortFieldLabel,
  SortDirection,
} from '../lib/application-sort';
import { apiRequest } from '../lib/api';
import {
  classifyJobSiteApplyMode,
  extractRealJdSite,
  JobSiteApplyMode,
  jobSiteApplyModeLabel,
} from '../lib/real-jd-site';
import { formatCostBreakdown, formatUsd } from '../lib/format-cost';
import {
  applicationStatusClass,
  applicationStatusLabel,
  isAppliedStatus,
  normalizeApplicationStatus,
} from '../lib/application-status';
import { Application, Profile } from '../types';
import './ApplicationsPage.css';

function isMultiSelectEvent(event: React.MouseEvent): boolean {
  return event.ctrlKey || event.metaKey;
}

function formatApplicationDate(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getAppliedDate(app: Application): string | undefined {
  if (app.appliedAt) return app.appliedAt;
  if (isAppliedStatus(app.status)) return app.updatedAt;
  return undefined;
}

function CompanyAvatar({
  companyName,
  logoUrl,
}: {
  companyName: string;
  logoUrl?: string;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !logoFailed;

  return (
    <div className={`company-avatar${showLogo ? ' has-logo' : ''}`}>
      {showLogo ? (
        <img
          src={logoUrl}
          alt={`${companyName} logo`}
          className="company-avatar-img"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        companyName.charAt(0).toUpperCase()
      )}
    </div>
  );
}

function ApplicationUrlRow({
  label,
  url,
  variant = 'linkedin',
}: {
  label: string;
  url: string;
  variant?: 'linkedin' | 'real';
}) {
  if (!url) return null;

  return (
    <div className={`application-url-row application-url-row-${variant}`}>
      <span className="application-url-label">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="application-url-text"
        title={url}
        onClick={(event) => event.stopPropagation()}
      >
        {url}
      </a>
    </div>
  );
}

function ApplicationCard({
  app,
  index,
  expanded,
  selected,
  onSelect,
  onToggleExpand,
  onViewResume,
}: {
  app: Application;
  index: number;
  expanded: boolean;
  selected: boolean;
  onSelect: (index: number, event: React.MouseEvent) => void;
  onToggleExpand: () => void;
  onViewResume: (resumeUrl: string, title: string) => void;
}) {
  const skills = app.skills;
  const breakdown = formatCostBreakdown(app.aiCostBreakdown);
  const status = normalizeApplicationStatus(app.status);
  const linkedInUrl = app.linkedInJobUrl || '';
  const realJobUrl = app.realJobUrl || '';
  const realJdSite = extractRealJdSite(realJobUrl);
  const applyMode = classifyJobSiteApplyMode(realJobUrl);

  return (
    <div className={`card application-card${selected ? ' selected' : ''}`}>
      <div
        className="application-header"
        onClick={(event) => onSelect(index, event)}
      >
        <div className="application-header-main">
          <input
            type="checkbox"
            className="application-select-checkbox"
            checked={selected}
            readOnly
            aria-label={`Select ${app.companyName} application`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(index, event);
            }}
          />
          <CompanyAvatar companyName={app.companyName} logoUrl={app.companyLogoUrl} />
          <div className="application-header-text">
            <h3>{app.jobTitle}</h3>
            <p className="application-meta">
              {app.companyName}
              {realJdSite ? <span className="application-site-tag"> · {realJdSite}</span> : null}
              <span className={`application-apply-mode application-apply-mode-${applyMode}`}>
                {' '}
                · {jobSiteApplyModeLabel(applyMode)}
              </span>
            </p>
            <div className="application-list-urls">
              <ApplicationUrlRow label="LinkedIn JD" url={linkedInUrl} variant="linkedin" />
              <ApplicationUrlRow label="Real JD" url={realJobUrl} variant="real" />
            </div>
            <div className="application-list-dates">
              <span>
                <strong>Recorded:</strong> {formatApplicationDate(app.createdAt)}
              </span>
              <span>
                <strong>Applied:</strong> {formatApplicationDate(getAppliedDate(app))}
              </span>
            </div>
          </div>
        </div>
        <div className="application-badges">
          <span className="badge badge-cost">{formatUsd(app.aiCostUsd)}</span>
          <span className={`badge ${applicationStatusClass(status)}`}>{applicationStatusLabel(status)}</span>
          <button
            type="button"
            className={`expand-chevron${expanded ? ' open' : ''}`}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand();
            }}
          >
            ›
          </button>
        </div>
      </div>

      {expanded && (
        <div className="application-details">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Company</span>
              <span>{app.companyName}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Title</span>
              <span>{app.jobTitle}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className={`badge ${applicationStatusClass(status)}`}>{applicationStatusLabel(status)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Apply mode</span>
              <span>{jobSiteApplyModeLabel(applyMode)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Real JD site</span>
              <span>{realJdSite || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">AI cost</span>
              <span>{formatUsd(app.aiCostUsd)}</span>
            </div>
            {breakdown ? (
              <div className="detail-item detail-item-wide">
                <span className="detail-label">Cost breakdown</span>
                <span>{breakdown}</span>
              </div>
            ) : null}
            <div className="detail-item">
              <span className="detail-label">Location</span>
              <span>{app.location || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Recorded</span>
              <span>{formatApplicationDate(app.createdAt)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Applied</span>
              <span>{formatApplicationDate(getAppliedDate(app))}</span>
            </div>
            {app.updatedAt !== app.createdAt ? (
              <div className="detail-item">
                <span className="detail-label">Last updated</span>
                <span>{new Date(app.updatedAt).toLocaleString()}</span>
              </div>
            ) : null}
            {app.resumeUrl ? (
              <div className="detail-item detail-item-wide">
                <span className="detail-label">Resume</span>
                <button
                  type="button"
                  className="application-resume-link"
                  onClick={() =>
                    onViewResume(app.resumeUrl!, `${app.jobTitle} at ${app.companyName}`)
                  }
                >
                  View generated resume
                </button>
              </div>
            ) : (
              <div className="detail-item">
                <span className="detail-label">Resume</span>
                <span className="muted">Not generated yet</span>
              </div>
            )}
          </div>

          <div className="detail-block">
            <span className="detail-label">Job Description</span>
            <p className="jd-text">{app.jobDescription}</p>
          </div>

          {skills ? (
            <div className="skills-section">
              <h4>Extracted Skills</h4>
              <div className="skills-grid">
                <div className="skill-field">
                  <span className="detail-label">Role</span>
                  <span>{skills.role || '—'}</span>
                </div>
                <div className="skill-field">
                  <span className="detail-label">Title</span>
                  <span>{skills.title || '—'}</span>
                </div>
                <div className="skill-field">
                  <span className="detail-label">Focus</span>
                  <span>{skills.focus || '—'}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const { userId, token } = useAuthScope();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState('');
  const [markingApplied, setMarkingApplied] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'recorded' | 'applied'>('all');
  const [siteFilter, setSiteFilter] = useState<'all' | JobSiteApplyMode>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [dateFilterField, setDateFilterField] =
    useState<ApplicationDateField>('recorded');
  const [sortField, setSortField] = useState<ApplicationSortField>('recordedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingResume, setViewingResume] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const selectionAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    setApplications([]);
    setProfile(null);
    setExpanded(null);
    setSelectedIds(new Set());
    setViewingResume(null);
    setProfileLoading(true);
  }, [userId]);

  const loadApplications = useCallback(async () => {
    if (!token || !userId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiRequest<Application[]>('/applications', { token });
      setApplications(data);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const loadProfile = useCallback(async () => {
    if (!token || !userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    try {
      setProfile(await loadUserProfile(token));
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      const status = normalizeApplicationStatus(app.status);
      if (filter === 'applied' && !isAppliedStatus(status)) return false;
      if (filter === 'recorded' && isAppliedStatus(status)) return false;

      const applyMode = classifyJobSiteApplyMode(app.realJobUrl);
      if (siteFilter !== 'all' && applyMode !== siteFilter) return false;

      if (
        !matchesApplicationDateFilter(
          app.createdAt,
          getAppliedDate(app),
          dateFilter,
          dateFilterField,
        )
      ) {
        return false;
      }

      return true;
    });
  }, [applications, filter, siteFilter, dateFilter, dateFilterField]);

  const sorted = useMemo(
    () => sortApplications(filtered, sortField, sortDirection),
    [filtered, sortField, sortDirection],
  );

  const sortedIds = useMemo(() => sorted.map((app) => app.id), [sorted]);
  const totalCost = filtered.reduce((sum, app) => sum + (app.aiCostUsd ?? 0), 0);
  const visibleCount = sorted.length;
  const hasActiveFilters =
    filter !== 'all' || siteFilter !== 'all' || Boolean(dateFilter);

  const clearAllFilters = () => {
    setFilter('all');
    setSiteFilter('all');
    setDateFilter('');
  };
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    sorted.length > 0 && sorted.every((app) => selectedIds.has(app.id));
  const selectedApps = useMemo(
    () => sorted.filter((app) => selectedIds.has(app.id)),
    [sorted, selectedIds],
  );
  const selectedReadyToApplyCount = selectedApps.filter((app) =>
    applicationCanMarkApplied(app),
  ).length;
  const selectedWithoutResumeCount = selectedApps.filter(
    (app) => !applicationHasResume(app),
  ).length;
  const selectedGeneratableApp =
    selectedApps.length === 1 &&
    !applicationHasResume(selectedApps[0]) &&
    applicationHasExtractedSkills(selectedApps[0]) &&
    !applicationIsApplied(selectedApps[0])
      ? selectedApps[0]
      : null;
  const exportDisabledReason =
    selectedCount === 0
      ? 'Select applications to export.'
      : selectedWithoutResumeCount > 0
        ? 'Export only works for applications with generated resumes.'
        : '';
  const canExportSelected = exportDisabledReason === '';
  const markAppliedDisabledReason =
    selectedCount === 0
      ? 'Select applications to mark as applied.'
      : selectedWithoutResumeCount > 0
        ? 'Mark as applied is only available after a resume is generated.'
        : selectedReadyToApplyCount === 0
          ? 'All selected applications are already applied.'
          : '';
  const canMarkAppliedSelected = markAppliedDisabledReason === '';
  const generateResumeDisabledReason = getGenerateResumeDisabledReason(profile, {
    profileLoading,
    targetLabel: 'The selected application',
    hasSkills: selectedGeneratableApp
      ? applicationHasExtractedSkills(selectedGeneratableApp)
      : undefined,
    hasResume: selectedGeneratableApp
      ? applicationHasResume(selectedGeneratableApp)
      : undefined,
    isApplied: selectedGeneratableApp
      ? applicationIsApplied(selectedGeneratableApp)
      : undefined,
    generating,
  });
  const canGenerateResume =
    Boolean(selectedGeneratableApp) && generateResumeDisabledReason === '';
  const showGenerateResumeButton = Boolean(selectedGeneratableApp);

  const handleSelect = useCallback(
    (index: number, event: React.MouseEvent) => {
      const id = sortedIds[index];
      if (!id) return;

      if (event.shiftKey && selectionAnchorRef.current !== null) {
        const start = Math.min(selectionAnchorRef.current, index);
        const end = Math.max(selectionAnchorRef.current, index);
        const rangeIds = sortedIds.slice(start, end + 1);

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
    [sortedIds],
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((previous) => {
        const next = new Set(previous);
        sortedIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelectedIds((previous) => {
      const next = new Set(previous);
      sortedIds.forEach((id) => next.add(id));
      return next;
    });
    selectionAnchorRef.current = 0;
  };

  const toggleSortDirection = () => {
    setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
  };

  const handleExport = async () => {
    if (!token) return;

    if (!canExportSelected) {
      if (exportDisabledReason) {
        showToast(exportDisabledReason, 'info');
      }
      return;
    }

    setExporting(true);
    try {
      const currentProfile = profile || (await loadUserProfile(token));

      const result = await exportSelectedApplications(
        selectedApps,
        [currentProfile],
        token,
      );

      showToast(
        `Exported ${result.exportedCount} application${result.exportedCount !== 1 ? 's' : ''}` +
          (result.resumeCount > 0
            ? ` with ${result.resumeCount} resume${result.resumeCount !== 1 ? 's' : ''}.`
            : '.'),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateResume = async () => {
    if (!token || !selectedGeneratableApp || !canGenerateResume) {
      if (generateResumeDisabledReason) {
        showToast(generateResumeDisabledReason, 'error');
      }
      return;
    }

    setGenerating(true);
    setGenerateMessage('');
    try {
      const currentProfile = profile || (await loadUserProfile(token));
      setProfile(currentProfile);

      const result = await generateResumeFromApplication(
        selectedGeneratableApp,
        currentProfile,
        token,
        setGenerateMessage,
      );

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

  const handleMarkSelectedApplied = async () => {
    if (!token) return;

    if (!canMarkAppliedSelected) {
      if (markAppliedDisabledReason) {
        showToast(markAppliedDisabledReason, 'info');
      }
      return;
    }

    const idsToMark = selectedApps
      .filter((app) => applicationCanMarkApplied(app))
      .map((app) => app.id);

    setMarkingApplied(true);
    try {
      const updated = await apiRequest<Application[]>('/applications/bulk/applied', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ ids: idsToMark }),
      });

      const updatedById = new Map(updated.map((app) => [app.id, app]));
      setApplications((previous) =>
        previous.map((app) => updatedById.get(app.id) || app),
      );

      showToast(
        `Marked ${updated.length} application${updated.length !== 1 ? 's' : ''} as applied.`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to mark as applied', 'error');
    } finally {
      setMarkingApplied(false);
    }
  };

  return (
    <div className="applications-page">
      <div className="page-header applications-page-header">
        <div>
          <h1>Applications</h1>
          <p>Jobs where you extracted skills or generated a resume</p>
        </div>
      </div>

      <section className="applications-controls card" aria-label="Filter and sort applications">
        <div className="applications-controls-grid">
          <div className="control-group">
            <span className="control-group-label">Status</span>
            <div className="segmented-control" role="tablist" aria-label="Application status">
              {(['all', 'recorded', 'applied'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={`segmented-control-btn${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'applied' ? 'Applied' : 'Recorded'}
                </button>
              ))}
            </div>
          </div>

          <div className="control-group control-group-wide">
            <span className="control-group-label">Job site</span>
            <div className="segmented-control" role="tablist" aria-label="Job site apply mode">
              {(['all', 'autobid', 'extension', 'other'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={siteFilter === f}
                  className={`segmented-control-btn segmented-control-btn-site segmented-control-btn-site-${f}${siteFilter === f ? ' active' : ''}`}
                  onClick={() => setSiteFilter(f)}
                >
                  {f === 'all'
                    ? 'All sites'
                    : f === 'autobid'
                      ? 'Autobid'
                      : f === 'extension'
                        ? 'Extension'
                        : 'Other'}
                </button>
              ))}
            </div>
            <p className="control-group-hint">
              Autobid: Greenhouse, Workday · Extension: Ashby, Lever, Workable · Other: remaining sites
            </p>
          </div>

          <div className="control-group">
            <span className="control-group-label">Date</span>
            <div className="control-field-row">
              <select
                id="applications-date-field"
                className="control-select"
                value={dateFilterField}
                onChange={(event) =>
                  setDateFilterField(event.target.value as ApplicationDateField)
                }
                aria-label="Date field"
              >
                <option value="recorded">Recorded date</option>
                <option value="applied">Applied date</option>
              </select>
              <input
                type="date"
                className="control-input"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                aria-label="Filter by date"
              />
              {dateFilter ? (
                <button
                  type="button"
                  className="control-clear-btn"
                  onClick={() => setDateFilter('')}
                >
                  Clear date
                </button>
              ) : null}
            </div>
          </div>

          <div className="control-group">
            <span className="control-group-label">Sort</span>
            <div className="control-field-row">
              <select
                id="applications-sort"
                className="control-select"
                value={sortField}
                onChange={(event) => setSortField(event.target.value as ApplicationSortField)}
                aria-label="Sort field"
              >
                {(['companyName', 'status', 'realJdSite', 'recordedAt'] as const).map((field) => (
                  <option key={field} value={field}>
                    {sortFieldLabel(field)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`sort-direction-btn${sortDirection === 'asc' ? ' asc' : ' desc'}`}
                onClick={toggleSortDirection}
                aria-label={`Sort ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
              >
                <span className="sort-direction-icon" aria-hidden="true">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
                {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="applications-active-filters">
            <span className="applications-active-filters-label">Active filters</span>
            <div className="applications-active-filter-chips">
              {filter !== 'all' ? (
                <span className="active-filter-chip">
                  Status: {filter === 'applied' ? 'Applied' : 'Recorded'}
                </span>
              ) : null}
              {siteFilter !== 'all' ? (
                <span className="active-filter-chip">
                  Site: {jobSiteApplyModeLabel(siteFilter)}
                </span>
              ) : null}
              {dateFilter ? (
                <span className="active-filter-chip">
                  {dateFilterField === 'recorded' ? 'Recorded' : 'Applied'} on{' '}
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

      <div className="applications-summary">
        <label className="applications-select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            disabled={sorted.length === 0}
          />
          <span>
            {loading
              ? 'Loading applications...'
              : `${visibleCount} application${visibleCount !== 1 ? 's' : ''}`}
          </span>
        </label>
        {selectedCount > 0 ? (
          <span className="selection-summary">{selectedCount} selected</span>
        ) : null}
        {!loading && visibleCount > 0 ? (
          <span className="cost-summary">Total AI cost: {formatUsd(totalCost)}</span>
        ) : null}
        <div className="applications-summary-actions">
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
          <DisabledButtonWithTooltip
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={markingApplied || !canMarkAppliedSelected}
            disabledReason={
              !markingApplied && markAppliedDisabledReason
                ? markAppliedDisabledReason
                : undefined
            }
            onClick={() => void handleMarkSelectedApplied()}
          >
            {markingApplied ? 'Updating...' : 'Mark as Applied'}
          </DisabledButtonWithTooltip>
          <DisabledButtonWithTooltip
            type="button"
            className="btn btn-primary btn-sm applications-export-btn"
            disabled={exporting || !canExportSelected}
            disabledReason={
              !exporting && exportDisabledReason ? exportDisabledReason : undefined
            }
            onClick={() => void handleExport()}
          >
            {exporting ? 'Exporting...' : 'Export Selected'}
          </DisabledButtonWithTooltip>
        </div>
        {generating && generateMessage ? (
          <p className="applications-generate-status">{generateMessage}</p>
        ) : null}
      </div>

      <p className="applications-selection-hint">
        Click to select. Ctrl/Cmd+click for multi-select. Shift+click to select a range.
      </p>

      <div className="applications-list">
        {!loading && sorted.length === 0 ? (
          <div className="card application-empty">
            No applications yet. Save one from the LinkedIn extension.
          </div>
        ) : null}
        {sorted.map((app, index) => (
          <ApplicationCard
            key={app.id}
            app={app}
            index={index}
            expanded={expanded === app.id}
            selected={selectedIds.has(app.id)}
            onSelect={handleSelect}
            onToggleExpand={() => setExpanded(expanded === app.id ? null : app.id)}
                onViewResume={(resumeUrl, title) => setViewingResume({ url: resumeUrl, title })}
          />
        ))}
      </div>

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
