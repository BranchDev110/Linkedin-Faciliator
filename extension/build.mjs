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
const WEB_URL = env.WEB_URL || 'http://localhost:5173';
const API_URL = env.API_URL || 'http://localhost:3001';

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

  const webHost = `${WEB_URL.replace(/\/$/, '')}/*`;
  const apiHost = `${API_URL.replace(/\/$/, '')}/*`;

  manifest.host_permissions = Array.from(
    new Set([
      ...(manifest.host_permissions || []),
      webHost,
      apiHost,
      'http://localhost:5173/*',
      'http://localhost:3001/*',
    ]),
  );

  const bridgeScript = manifest.content_scripts?.find(
    (entry) => entry.js?.includes('web-bridge.js'),
  );
  if (bridgeScript) {
    bridgeScript.matches = Array.from(
      new Set([
        ...(bridgeScript.matches || []),
        webHost,
        'http://localhost:5173/*',
        'http://localhost:3001/*',
      ]),
    );
  }

  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
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
  __WEB_URL__: JSON.stringify(WEB_URL),
  __API_URL__: JSON.stringify(API_URL),
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
    'web-bridge': 'src/web-bridge.ts',
    'sidebar-host': 'src/sidebar-host.ts',
  },
  format: 'iife',
};

const moduleScriptBuild = {
  ...sharedBuildOptions,
  entryPoints: {
    background: 'src/background.ts',
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
    console.log(`Watching extension files (WEB_URL=${WEB_URL}, API_URL=${API_URL})...`);
  } else {
    await Promise.all([
      esbuild.build(moduleScriptBuild),
      esbuild.build(contentScriptBuild),
    ]);
    console.log(`Extension built to dist/ (WEB_URL=${WEB_URL}, API_URL=${API_URL})`);
  }
}

build().catch(() => process.exit(1));
