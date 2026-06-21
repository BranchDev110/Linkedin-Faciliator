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
import { Application, Profile } from '../types';
import './ApplicationChart.css';

interface ApplicationChartProps {
  title: string;
  period: ChartPeriod;
  profiles: Profile[];
  applications: Application[];
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
  profiles,
  applications,
}: ApplicationChartProps) {
  const [selectedProfileId, setSelectedProfileId] = useState('all');

  const data = useMemo(
    () =>
      buildChartData(
        applications,
        period,
        selectedProfileId === 'all' ? undefined : selectedProfileId,
      ),
    [applications, period, selectedProfileId],
  );

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="chart-title">{title}</h3>
        <select
          className="chart-profile-select"
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          aria-label={`Select profile for ${title} chart`}
        >
          <option value="all">All profiles</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.profileName}
            </option>
          ))}
        </select>
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
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
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
