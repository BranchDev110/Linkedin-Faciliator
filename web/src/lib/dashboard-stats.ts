import {
  Application,
  ChartDataPoint,
  DashboardStats,
  PricingChartDataPoint,
  Profile,
} from '../types';

export type ChartPeriod = 'week' | 'twoWeeks' | 'month' | 'quarter';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function getRecordedDate(app: Application): Date {
  return new Date(app.createdAt);
}

function getAppliedDate(app: Application): Date | null {
  if (app.status !== 'applied') return null;
  const value = app.appliedAt || app.updatedAt;
  return value ? new Date(value) : null;
}

function filterByDays(applications: Application[], days: number): Application[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return applications.filter((app) => getRecordedDate(app) >= cutoff);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/** Billable workflow cost: skill extraction + resume bullets only. */
export function getApplicationWorkflowCost(app: Application): number {
  const breakdown = app.aiCostBreakdown;
  if (breakdown) {
    return roundUsd(
      (breakdown.skillExtraction ?? 0) + (breakdown.resumeBullets ?? 0),
    );
  }
  return roundUsd(app.aiCostUsd ?? 0);
}

export function computeDashboardStats(
  profiles: Profile[],
  applications: Application[],
  userId?: string,
  profileId?: string,
): DashboardStats {
  let scopedApplications = applications;
  let scopedProfiles = profiles;

  if (userId) {
    scopedApplications = scopedApplications.filter((app) => app.userId === userId);
    scopedProfiles = scopedProfiles.filter((profile) => profile.userId === userId);
  }
  if (profileId) {
    scopedApplications = scopedApplications.filter((app) => app.profileId === profileId);
  }

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayRecorded = scopedApplications.filter((app) =>
    isSameDay(getRecordedDate(app), now),
  ).length;

  const todayApplied = scopedApplications.filter((app) => {
    const appliedDate = getAppliedDate(app);
    return appliedDate ? isSameDay(appliedDate, now) : false;
  }).length;

  const yesterdayRecorded = scopedApplications.filter((app) =>
    isSameDay(getRecordedDate(app), yesterday),
  ).length;

  const yesterdayApplied = scopedApplications.filter((app) => {
    const appliedDate = getAppliedDate(app);
    return appliedDate ? isSameDay(appliedDate, yesterday) : false;
  }).length;

  const totalAiCostUsd = roundUsd(
    scopedApplications.reduce((sum, app) => sum + getApplicationWorkflowCost(app), 0),
  );

  return {
    profileCount: scopedProfiles.length,
    totalRecorded: scopedApplications.length,
    totalApplied: scopedApplications.filter((app) => app.status === 'applied').length,
    todayRecorded,
    todayApplied,
    yesterdayRecorded,
    yesterdayApplied,
    totalAiCostUsd,
  };
}

interface Bucket {
  label: string;
  sortKey: number;
  recorded: number;
  applied: number;
}

function createBuckets(period: ChartPeriod): Bucket[] {
  const periodDays = { week: 7, twoWeeks: 14, month: 30, quarter: 90 }[period];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets: Bucket[] = [];

  if (period === 'quarter') {
    for (let i = 12; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      buckets.push({
        label: formatWeekLabel(d),
        recorded: 0,
        applied: 0,
        sortKey: d.getTime(),
      });
    }
    return buckets;
  }

  if (period === 'month') {
    for (let i = 29; i >= 0; i -= 3) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.push({
        label: formatDayLabel(d),
        recorded: 0,
        applied: 0,
        sortKey: d.getTime(),
      });
    }
    return buckets;
  }

  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({
      label: formatDayLabel(d),
      recorded: 0,
      applied: 0,
      sortKey: d.getTime(),
    });
  }

  return buckets;
}

function nearestBucket<T extends { sortKey: number }>(buckets: T[], date: Date): T {
  const normalized = startOfDay(date);
  let bucket = buckets[0];
  let minDiff = Math.abs(bucket.sortKey - normalized.getTime());

  for (const candidate of buckets) {
    const diff = Math.abs(candidate.sortKey - normalized.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      bucket = candidate;
    }
  }

  return bucket;
}

export function buildChartData(
  applications: Application[],
  period: ChartPeriod,
  profileId?: string,
  userId?: string,
): ChartDataPoint[] {
  let scoped = applications;
  if (userId) {
    scoped = scoped.filter((app) => app.userId === userId);
  }
  if (profileId) {
    scoped = scoped.filter((app) => app.profileId === profileId);
  }
  const periodDays = { week: 7, twoWeeks: 14, month: 30, quarter: 90 }[period];
  const filtered = filterByDays(scoped, periodDays);
  const buckets = createBuckets(period);

  for (const app of filtered) {
    nearestBucket(buckets, getRecordedDate(app)).recorded += 1;

    const appliedDate = getAppliedDate(app);
    if (appliedDate) {
      nearestBucket(buckets, appliedDate).applied += 1;
    }
  }

  return buckets.map(({ label, recorded, applied }) => ({
    label,
    recorded,
    applied,
  }));
}

interface PricingBucket {
  label: string;
  sortKey: number;
  skillExtraction: number;
  resumeBullets: number;
}

function createPricingBuckets(period: ChartPeriod): PricingBucket[] {
  return createBuckets(period).map((bucket) => ({
    label: bucket.label,
    sortKey: bucket.sortKey,
    skillExtraction: 0,
    resumeBullets: 0,
  }));
}

export function buildPricingChartData(
  applications: Application[],
  period: ChartPeriod,
  profileId?: string,
  userId?: string,
): PricingChartDataPoint[] {
  let scoped = applications;
  if (userId) {
    scoped = scoped.filter((app) => app.userId === userId);
  }
  if (profileId) {
    scoped = scoped.filter((app) => app.profileId === profileId);
  }
  const periodDays = { week: 7, twoWeeks: 14, month: 30, quarter: 90 }[period];
  const filtered = filterByDays(scoped, periodDays);
  const buckets = createPricingBuckets(period);

  for (const app of filtered) {
    const bucket = nearestBucket(buckets, getRecordedDate(app));
    const breakdown = app.aiCostBreakdown;

    if (breakdown) {
      bucket.skillExtraction += breakdown.skillExtraction ?? 0;
      bucket.resumeBullets += breakdown.resumeBullets ?? 0;
    } else if ((app.aiCostUsd ?? 0) > 0) {
      bucket.skillExtraction += app.aiCostUsd ?? 0;
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    skillExtraction: roundUsd(bucket.skillExtraction),
    resumeBullets: roundUsd(bucket.resumeBullets),
    total: roundUsd(bucket.skillExtraction + bucket.resumeBullets),
  }));
}
