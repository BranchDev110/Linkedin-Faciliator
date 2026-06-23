import { useCallback, useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import ApplicationChart from '../components/ApplicationChart';
import PricingChart from '../components/PricingChart';
import { useAuth } from '../context/AuthContext';
import { computeDashboardStats } from '../lib/dashboard-stats';
import { apiRequest } from '../lib/api';
import { formatUsd } from '../lib/format-cost';
import { AdminUserSummary, Application } from '../types';
import '../pages/DashboardPage.css';

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const [usersData, applicationsData] = await Promise.all([
        apiRequest<AdminUserSummary[]>('/admin/users', { token }),
        apiRequest<Application[]>('/admin/applications', { token }),
      ]);

      setUsers(usersData);
      setApplications(applicationsData);
    } catch (err) {
      setUsers([]);
      setApplications([]);
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  const stats = useMemo(
    () =>
      computeDashboardStats(
        [],
        applications,
        selectedUserId === 'all' ? undefined : selectedUserId,
      ),
    [applications, selectedUserId],
  );

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p>Metrics across all users</p>
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

      <div className="dashboard-admin-filters">
        <select
          className="chart-profile-select"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          <option value="all">All users</option>
          {users.map((user) => (
            <option key={user.uid} value={user.uid}>
              {user.email}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="dashboard-error" role="alert">
          {error}
        </div>
      )}

      {loading && !applications.length && !error ? (
        <div className="dashboard-loading">Loading admin dashboard...</div>
      ) : (
        <>
          <section className="dashboard-section">
            <h2 className="section-title">Overview</h2>
            <div className="dashboard-stats-grid overview-grid overview-grid-3">
              <StatCard label="Total Recorded" value={stats.totalRecorded} sublabel="Jobs saved" variant="recorded" />
              <StatCard label="Total Applied" value={stats.totalApplied} sublabel="Applications submitted" variant="applied" />
              <StatCard label="Total AI Spend" displayValue={formatUsd(stats.totalAiCostUsd)} sublabel="Skills + resume bullets" variant="cost" />
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
              <ApplicationChart title="Last 7 Days" period="week" applications={applications} adminUsers={users} />
              <ApplicationChart title="Last 2 Weeks" period="twoWeeks" applications={applications} adminUsers={users} />
              <ApplicationChart title="Last Month" period="month" applications={applications} adminUsers={users} />
              <ApplicationChart title="Last Quarter" period="quarter" applications={applications} adminUsers={users} />
            </div>
          </section>

          <section className="dashboard-section">
            <h2 className="section-title">AI Pricing</h2>
            <div className="dashboard-charts-grid">
              <PricingChart title="Last 7 Days" period="week" applications={applications} adminUsers={users} />
              <PricingChart title="Last 2 Weeks" period="twoWeeks" applications={applications} adminUsers={users} />
              <PricingChart title="Last Month" period="month" applications={applications} adminUsers={users} />
              <PricingChart title="Last Quarter" period="quarter" applications={applications} adminUsers={users} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
