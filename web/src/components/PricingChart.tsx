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
import { buildPricingChartData, ChartPeriod } from '../lib/dashboard-stats';
import { formatUsd } from '../lib/format-cost';
import { AdminUserSummary, Application } from '../types';
import './ApplicationChart.css';

interface PricingChartProps {
  title: string;
  period: ChartPeriod;
  applications: Application[];
  adminUsers?: AdminUserSummary[];
}

const COLORS = {
  skillExtraction: '#8b5cf6',
  resumeBullets: '#f59e0b',
};

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

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          {entry.name}: <strong>{formatUsd(entry.value)}</strong>
        </p>
      ))}
      <p className="chart-tooltip-row chart-tooltip-total">
        Total: <strong>{formatUsd(total)}</strong>
      </p>
    </div>
  );
};

export default function PricingChart({
  title,
  period,
  applications,
  adminUsers,
}: PricingChartProps) {
  const [selectedUserId, setSelectedUserId] = useState('all');
  const isAdminMode = Boolean(adminUsers?.length);

  const data = useMemo(
    () =>
      buildPricingChartData(
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
              aria-label={`Select user for ${title} pricing chart`}
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
        <BarChart data={data} margin={{ top: 4, right: 4, left: -8, bottom: 0 }} barGap={2}>
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
            tickFormatter={(value) => formatUsd(Number(value))}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="skillExtraction"
            name="Skills"
            fill={COLORS.skillExtraction}
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            stackId="cost"
          />
          <Bar
            dataKey="resumeBullets"
            name="Bullets"
            fill={COLORS.resumeBullets}
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
            stackId="cost"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
