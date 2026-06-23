import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { buildChartData, ChartPeriod } from '../lib/dashboard-stats';
import { AdminUserSummary, Application } from '../types';
import './ApplicationChart.css';

interface ApplicationChartProps {
  title: string;
  period: ChartPeriod;
  applications: Application[];
  adminUsers?: AdminUserSummary[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function ApplicationChart({
  title,
  period,
  applications,
  adminUsers,
}: ApplicationChartProps) {
  const [selectedUserId, setSelectedUserId] = useState('all');
  const isAdminMode = Boolean(adminUsers?.length);

  const data = useMemo(
    () =>
      buildChartData(
        applications,
        period,
        undefined,
        isAdminMode && selectedUserId !== 'all' ? selectedUserId : undefined,
      ),
    [applications, period, selectedUserId, isAdminMode],
  );

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        {isAdminMode ? (
          <div className="chart-filter-group">
            <select
              className="chart-profile-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              aria-label={`Select user for ${title} chart`}
            >
              <option value="all">All users</option>
              {adminUsers?.map((user) => (
                <option key={user.uid} value={user.uid}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="recorded"
            name="Recorded"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
          <Bar
            dataKey="applied"
            name="Applied"
            fill="#10b981"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
