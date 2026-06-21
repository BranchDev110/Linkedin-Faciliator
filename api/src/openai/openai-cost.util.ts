import {
  ApplicationAiCostBreakdown,
  OpenAiCompletionUsage,
  OpenAiUsageRecord,
} from './openai-usage.types';

const MODEL_PRICING_USD_PER_MILLION: Record<
  string,
  { input: number; output: number }
> = {
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

const DEFAULT_PRICING = MODEL_PRICING_USD_PER_MILLION['gpt-5.4-mini'];

export function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function calculateOpenAiCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing =
    MODEL_PRICING_USD_PER_MILLION[model] ??
    MODEL_PRICING_USD_PER_MILLION[model.replace(/-\d{4}-\d{2}-\d{2}$/, '')] ??
    DEFAULT_PRICING;

  const cost =
    (promptTokens * pricing.input + completionTokens * pricing.output) /
    1_000_000;

  return roundUsd(cost);
}

export function usageFromCompletion(
  model: string,
  usage?: OpenAiCompletionUsage | null,
): OpenAiUsageRecord | null {
  if (!usage) return null;

  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;

  if (promptTokens === 0 && completionTokens === 0) {
    return null;
  }

  return {
    model,
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
    costUsd: calculateOpenAiCost(model, promptTokens, completionTokens),
  };
}

export function formatUsd(cost: number): string {
  if (cost <= 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function mergeCostBreakdown(
  current: ApplicationAiCostBreakdown | undefined,
  category: keyof ApplicationAiCostBreakdown,
  costUsd: number,
): ApplicationAiCostBreakdown {
  const next = { ...(current || {}) };
  next[category] = roundUsd((next[category] ?? 0) + costUsd);
  return next;
}
