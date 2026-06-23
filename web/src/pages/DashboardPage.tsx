import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import ApplicationChart from '../components/ApplicationChart';
import PricingChart from '../components/PricingChart';
import { useAuthScope } from '../hooks/useAuthScope';
import { computeDashboardStats } from '../lib/dashboard-stats';
import { apiRequest } from '../lib/api';
import { formatUsd } from '../lib/format-cost';
import { Application } from '../types';
import './DashboardPage.css';

export default function DashboardPage() {
  const { userId, token } = useAuthScope();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setApplications([]);
    setError('');
  }, [userId]);

  const loadDashboardData = useCallback(async () => {
    if (!token || !userId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const applicationsData = await apiRequest<Application[]>('/applications', { token });
      setApplications(applicationsData);
    } catch (err) {
      setApplications([]);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const stats = useMemo(
    () => computeDashboardStats([], applications),
    [applications],
  );

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Track application activity and AI spend</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary dashboard-refresh-btn"
          onClick={() => void loadDashboardData()}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading && !applications.length && !error ? (
        <div className="dashboard-loading">Loading dashboard...</div>
      ) : (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">Overview</h2>
            <div className="dashboard-stats-grid overview-grid overview-grid-3">
              <StatCard
                label="Total Recorded"
                value={stats.totalRecorded}
                sublabel="Jobs saved"
                variant="recorded"
              />
              <StatCard
                label="Total Applied"
                value={stats.totalApplied}
                sublabel="Applications submitted"
                variant="applied"
              />
              <StatCard
                label="Total AI Spend"
                displayValue={formatUsd(stats.totalAiCostUsd)}
                sublabel="Skills + resume bullets"
                variant="cost"
              />
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">Recent Activity</h2>
            <div className="dashboard-stats-grid activity-grid">
              <StatCard label="Today Recorded" value={stats.todayRecorded} variant="today" />
              <StatCard label="Today Applied" value={stats.todayApplied} variant="today" />
              <StatCard label="Yesterday Recorded" value={stats.yesterdayRecorded} variant="yesterday" />
              <StatCard label="Yesterday Applied" value={stats.yesterdayApplied} variant="yesterday" />
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">Application Activity</h2>
            <div className="dashboard-charts-grid">
              <ApplicationChart
                title="Last 7 Days"
                period="week"
                applications={applications}
              />
              <ApplicationChart
                title="Last 2 Weeks"
                period="twoWeeks"
                applications={applications}
              />
              <ApplicationChart
                title="Last Month"
                period="month"
                applications={applications}
              />
              <ApplicationChart
                title="Last Quarter"
                period="quarter"
                applications={applications}
              />
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">AI Pricing</h2>
            <p className="section-description">
              OpenAI costs grouped by when each application was recorded — skill
              extraction and resume bullet generation. Total is the sum of both.
            </p>
            <div className="dashboard-charts-grid">
              <PricingChart
                title="Last 7 Days"
                period="week"
                applications={applications}
              />
              <PricingChart
                title="Last 2 Weeks"
                period="twoWeeks"
                applications={applications}
              />
              <PricingChart
                title="Last Month"
                period="month"
                applications={applications}
              />
              <PricingChart
                title="Last Quarter"
                period="quarter"
                applications={applications}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
