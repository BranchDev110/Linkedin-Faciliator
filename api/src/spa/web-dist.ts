import { existsSync } from 'fs';
import { join } from 'path';

export function resolveWebDistPath(): string {
  const candidates = [
    join(process.cwd(), '..', 'web', 'dist'),
    join(process.cwd(), 'web', 'dist'),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  return candidates[0];
}

export function resolveWebIndexPath(): string | null {
  const dist = resolveWebDistPath();
  const indexPath = join(dist, 'index.html');
  return existsSync(indexPath) ? indexPath : null;
}
