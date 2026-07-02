import { Profile } from '../types';

export interface CompanyBulletGenerationResult {
  company: string;
  bullets: string[];
}

function expectedBulletCount(profile: Profile, companyName: string): number {
  const company = profile.companies.find((entry) => entry.name === companyName);
  return Math.max(1, company?.bulletCount ?? 1);
}

export function countFilledBullets(bullets: string[]): number {
  return bullets.filter((bullet) => bullet.trim()).length;
}

export function isCompanyBulletResultComplete(
  profile: Profile,
  result: CompanyBulletGenerationResult | undefined,
): boolean {
  if (!result) return false;
  return countFilledBullets(result.bullets) >= expectedBulletCount(profile, result.company);
}

export function areCompanyBulletsComplete(
  profile: Profile,
  results: CompanyBulletGenerationResult[],
): boolean {
  if (!profile.companies.length) return false;

  return profile.companies.every((company) =>
    isCompanyBulletResultComplete(
      profile,
      results.find((result) => result.company === company.name),
    ),
  );
}

export function getIncompleteCompanyNames(
  profile: Profile,
  results: CompanyBulletGenerationResult[],
): string[] {
  return profile.companies
    .filter(
      (company) =>
        !isCompanyBulletResultComplete(
          profile,
          results.find((result) => result.company === company.name),
        ),
    )
    .map((company) => company.name);
}
