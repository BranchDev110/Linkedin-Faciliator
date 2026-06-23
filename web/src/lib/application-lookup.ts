import { Application } from '../types';
import { normalizeAiCostBreakdown, sumTrackedAiCostUsd } from './format-cost';

export type ApplicationLookupResponse = {
  found: boolean;
  application: Application | null;
};

type ApplicationLike = {
  id?: string;
  _id?: string | { toString(): string };
};

export function resolveApplicationId(
  application: ApplicationLike | null | undefined,
): string | null {
  if (!application) {
    return null;
  }

  const rawId = application.id ?? application._id;
  if (typeof rawId === 'string' && rawId.trim() && rawId !== 'undefined') {
    return rawId.trim();
  }

  if (rawId && typeof rawId === 'object' && typeof rawId.toString === 'function') {
    const normalized = rawId.toString().trim();
    return normalized && normalized !== 'undefined' ? normalized : null;
  }

  return null;
}

export function isApplicationLookupResponse(
  value: unknown,
): value is ApplicationLookupResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'found' in value &&
    'application' in value
  );
}

function rawApplicationFromLookup(value: unknown): Application | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (isApplicationLookupResponse(value)) {
    return value.application;
  }

  return value as Application;
}

export function normalizeApplicationResponse(value: unknown): Application | null {
  const application = rawApplicationFromLookup(value);
  if (!application) {
    return null;
  }

  const id = resolveApplicationId(application);
  if (!id) {
    return null;
  }

  const aiCostBreakdown = normalizeAiCostBreakdown(application.aiCostBreakdown);

  return {
    ...application,
    id,
    aiCostBreakdown,
    aiCostUsd: sumTrackedAiCostUsd(aiCostBreakdown),
  };
}

export function unwrapApplicationLookup(value: unknown): Application | null {
  return normalizeApplicationResponse(value);
}

export function applicationHasResume(application: Application | null | undefined): boolean {
  if (!application) {
    return false;
  }

  if (application.resumeUrl?.trim()) {
    return true;
  }

  return application.status === 'resume_generated';
}

export function applicationIsApplied(application: Application | null | undefined): boolean {
  return application?.status === 'applied';
}

export function applicationCanMarkApplied(
  application: Application | null | undefined,
): boolean {
  if (!application || applicationIsApplied(application)) {
    return false;
  }

  return applicationHasResume(application);
}

export function applicationBlocksResumeGeneration(
  application: Application | null | undefined,
): boolean {
  return applicationHasResume(application) || applicationIsApplied(application);
}
