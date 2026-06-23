export interface OpenAiUsageRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export type AiCostCategory = 'skillExtraction' | 'resumeBullets';

export interface ApplicationAiCostBreakdown {
  skillExtraction?: number;
  resumeBullets?: number;
}

export interface OpenAiCompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}
