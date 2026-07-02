export interface CompanyBulletRequest {
  companyName: string;
  bulletCount: number;
}

export interface CompanyBulletResult {
  company: string;
  bullets: string[];
}

export function countFilledBullets(bullets: string[]): number {
  return bullets.filter((bullet) => bullet.trim()).length;
}

export function isCompanyBulletResultComplete(
  result: CompanyBulletResult | undefined,
  expectedBulletCount: number,
): boolean {
  if (!result) return false;
  return countFilledBullets(result.bullets) >= expectedBulletCount;
}

export function findIncompleteCompanyRequests(
  requests: CompanyBulletRequest[],
  results: CompanyBulletResult[],
): CompanyBulletRequest[] {
  const resultsByCompany = new Map(
    results.map((result) => [result.company, result]),
  );

  return requests.filter((request) =>
    !isCompanyBulletResultComplete(
      resultsByCompany.get(request.companyName),
      request.bulletCount,
    ),
  );
}

export function mergeCompanyBulletResults(
  current: CompanyBulletResult[],
  incoming: CompanyBulletResult[],
): CompanyBulletResult[] {
  const merged = new Map(current.map((result) => [result.company, result]));

  for (const result of incoming) {
    const existing = merged.get(result.company);
    if (!existing) {
      merged.set(result.company, result);
      continue;
    }

    const combinedBullets = [...existing.bullets];
    for (let index = 0; index < result.bullets.length; index += 1) {
      const nextBullet = result.bullets[index]?.trim() || '';
      if (!nextBullet) continue;

      const emptyIndex = combinedBullets.findIndex((bullet) => !bullet.trim());
      if (emptyIndex >= 0) {
        combinedBullets[emptyIndex] = nextBullet;
      } else if (index < combinedBullets.length) {
        combinedBullets[index] = nextBullet;
      } else {
        combinedBullets.push(nextBullet);
      }
    }

    merged.set(result.company, {
      company: result.company,
      bullets: combinedBullets,
    });
  }

  return [...merged.values()];
}

export function normalizeCompanyBulletResults(
  requests: CompanyBulletRequest[],
  results: CompanyBulletResult[],
): CompanyBulletResult[] {
  const resultsByCompany = new Map(
    results.map((result) => [result.company, result]),
  );

  return requests.map((request) => {
    const existing = resultsByCompany.get(request.companyName);
    const bullets = (existing?.bullets || [])
      .map((bullet) => bullet.trim())
      .filter(Boolean)
      .slice(0, request.bulletCount);

    while (bullets.length < request.bulletCount) {
      bullets.push('');
    }

    return {
      company: request.companyName,
      bullets,
    };
  });
}
