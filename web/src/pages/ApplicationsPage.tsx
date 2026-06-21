import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ResumeViewerModal from '../components/ResumeViewerModal';
import { useToast } from '../components/Toast';
import { exportSelectedApplications } from '../lib/application-export';
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
import { Application, Profile, Resume } from '../types';
import './ApplicationsPage.css';

function normalizeStatus(status: Application['status'] | string): Application['status'] {
  return status === 'applied' ? 'applied' : 'recorded';
}

function statusLabel(status: Application['status']): string {
  return normalizeStatus(status) === 'applied' ? 'Applied' : 'Recorded';
}

function statusClass(status: Application['status']): string {
  return normalizeStatus(status) === 'applied' ? 'badge-success' : 'badge-info';
}

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
  if (normalizeStatus(app.status) === 'applied') return app.updatedAt;
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
  onViewResume: (resumeId: string) => void;
}) {
  const skills = app.skills;
  const breakdown = formatCostBreakdown(app.aiCostBreakdown);
  const status = normalizeStatus(app.status);
  const linkedInUrl = app.linkedInJobUrl || app.jobUrl || '';
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
          <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>
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
              <span className={`badge ${statusClass(status)}`}>{statusLabel(status)}</span>
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
            {app.resumeId ? (
              <div className="detail-item detail-item-wide">
                <span className="detail-label">Resume</span>
                <button
                  type="button"
                  className="application-resume-link"
                  onClick={() => onViewResume(app.resumeId!)}
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
  const { token } = useAuth();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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
  const [viewingResumeId, setViewingResumeId] = useState<string | null>(null);
  const selectionAnchorRef = useRef<number | null>(null);

  const loadApplications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const data = await apiRequest<Application[]>('/applications', { token });
      setApplications(data);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      const status = normalizeStatus(app.status);
      if (filter === 'applied' && status !== 'applied') return false;
      if (filter === 'recorded' && status !== 'recorded') return false;

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
  const selectedNotAppliedCount = selectedApps.filter(
    (app) => normalizeStatus(app.status) !== 'applied',
  ).length;

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

    if (selectedCount === 0) {
      showToast('No applications selected.', 'info');
      return;
    }

    setExporting(true);
    try {
      const [profiles, resumes] = await Promise.all([
        apiRequest<Profile[]>('/profiles', { token }),
        apiRequest<Resume[]>('/resumes', { token }),
      ]);

      const result = await exportSelectedApplications(
        selectedApps,
        profiles,
        resumes,
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

  const handleMarkSelectedApplied = async () => {
    if (!token) return;

    if (selectedCount === 0) {
      showToast('No applications selected.', 'info');
      return;
    }

    if (selectedNotAppliedCount === 0) {
      showToast('All selected applications are already applied.', 'info');
      return;
    }

    const idsToMark = selectedApps
      .filter((app) => normalizeStatus(app.status) !== 'applied')
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
          <p>Job applications recorded from the Chrome extension</p>
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={markingApplied}
            onClick={() => void handleMarkSelectedApplied()}
          >
            {markingApplied ? 'Updating...' : 'Mark as Applied'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm applications-export-btn"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? 'Exporting...' : 'Export Selected'}
          </button>
        </div>
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
            onViewResume={setViewingResumeId}
          />
        ))}
      </div>

      {viewingResumeId && token ? (
        <ResumeViewerModal
          resumeId={viewingResumeId}
          token={token}
          onClose={() => setViewingResumeId(null)}
        />
      ) : null}
    </div>
  );
}
