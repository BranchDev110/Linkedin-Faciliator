export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini';

export function resolveOpenAiModel(configured?: string | null): string {
  const trimmed = configured?.trim();
  return trimmed || DEFAULT_OPENAI_MODEL;
}
