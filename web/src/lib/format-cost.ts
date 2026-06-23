/** Matches API micro-dollar precision (6 decimal places). */
export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function formatUsd(cost: number | undefined | null): string {
  const value = cost ?? 0;
  if (value <= 0) return '$0.00';

  let formatted = roundUsd(value).toFixed(6);
  formatted = formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '');

  if (!formatted.includes('.')) {
    return `$${formatted}.00`;
  }

  const [, fraction = ''] = formatted.split('.');
  if (fraction.length === 1) {
    return `$${formatted}0`;
  }

  return `$${formatted}`;
}

export function formatCostBreakdown(breakdown?: Record<string, number>): string {
  if (!breakdown) return '';

  const labels: Record<string, string> = {
    skillExtraction: 'Skills',
    resumeBullets: 'Bullets',
  };

  return Object.entries(breakdown)
    .filter(([key, amount]) => (labels[key] ? (amount ?? 0) > 0 : false))
    .map(([key, amount]) => `${labels[key] || key}: ${formatUsd(amount)}`)
    .join(' · ');
}

export function normalizeAiCostBreakdown(
  breakdown?: Record<string, number> | null,
): Record<string, number> {
  if (!breakdown) {
    return {};
  }

  const normalized: Record<string, number> = {};
  const skillExtraction = breakdown.skillExtraction;
  const resumeBullets = breakdown.resumeBullets;

  if (typeof skillExtraction === 'number' && skillExtraction > 0) {
    normalized.skillExtraction = roundUsd(skillExtraction);
  }
  if (typeof resumeBullets === 'number' && resumeBullets > 0) {
    normalized.resumeBullets = roundUsd(resumeBullets);
  }

  return normalized;
}

export function sumTrackedAiCostUsd(
  breakdown?: Record<string, number> | null,
): number {
  const normalized = normalizeAiCostBreakdown(breakdown);
  return roundUsd(
    (normalized.skillExtraction ?? 0) + (normalized.resumeBullets ?? 0),
  );
}
