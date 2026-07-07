import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const watch = process.argv.includes('--watch');
const outDir = 'dist';

function loadRootEnv() {
  const envPath = join('..', '.env');
  const env = {};

  if (!existsSync(envPath)) return env;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }

  return env;
}

const env = loadRootEnv();
const SENDER = env.SCRAPE_SENDER || 'li-job-scraper';
const API_ENDPOINT = env.SCRAPE_API_ENDPOINT || 'http://localhost:8979/api/expose/jobs';

function originFromUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

const API_ORIGIN = originFromUrl(API_ENDPOINT);

const staticFiles = [
  'sidebar.html',
  'sidebar.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

function patchManifest() {
  const manifestPath = 'manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const hostSet = new Set([
    'https://www.linkedin.com/*',
    'https://linkedin.com/*',
    ...(manifest.host_permissions || []),
  ]);

  if (API_ORIGIN) {
    hostSet.add(`${API_ORIGIN}/*`);
  }

  manifest.host_permissions = Array.from(hostSet);

  writeFileSync(
    join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function copyStatic() {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  if (!existsSync(join(outDir, 'icons'))) mkdirSync(join(outDir, 'icons'), { recursive: true });

  for (const file of staticFiles) {
    try {
      copyFileSync(file, join(outDir, file));
    } catch {
      // icons may not exist yet
    }
  }

  patchManifest();
}

const define = {
  __SENDER__: JSON.stringify(SENDER),
  __API_ENDPOINT__: JSON.stringify(API_ENDPOINT),
};

const sharedBuildOptions = {
  bundle: true,
  outdir: outDir,
  target: 'chrome110',
  sourcemap: true,
  define,
};

const contentScriptBuild = {
  ...sharedBuildOptions,
  entryPoints: {
    content: 'src/content.ts',
    'sidebar-host': 'src/sidebar-host.ts',
  },
  format: 'iife',
};

const moduleScriptBuild = {
  ...sharedBuildOptions,
  entryPoints: {
    sidebar: 'src/sidebar.ts',
  },
  format: 'esm',
};

async function build() {
  copyStatic();
  if (watch) {
    const moduleCtx = await esbuild.context(moduleScriptBuild);
    const contentCtx = await esbuild.context(contentScriptBuild);
    await Promise.all([moduleCtx.watch(), contentCtx.watch()]);
    console.log(
      `Watching extension-scrape files (SENDER=${SENDER}, API_ENDPOINT=${API_ENDPOINT})...`,
    );
  } else {
    await Promise.all([
      esbuild.build(moduleScriptBuild),
      esbuild.build(contentScriptBuild),
    ]);
    console.log(
      `extension-scrape built to dist/ (SENDER=${SENDER}, API_ENDPOINT=${API_ENDPOINT})`,
    );
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});