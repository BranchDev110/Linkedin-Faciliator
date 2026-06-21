#!/usr/bin/env node
/**
 * Generates placeholder PNG icons for the Chrome extension.
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'extension', 'icons');
mkdirSync(iconsDir, { recursive: true });

// Minimal valid 16x16 blue PNG
const minimalPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIAhYjChKMdI/0C0DA0AAAD//wMAVl4x90m5E5wAAAAASUVORK5CYII=',
  'base64',
);

for (const size of [16, 48, 128]) {
  writeFileSync(join(iconsDir, `icon${size}.png`), minimalPng);
  console.log(`Created icon${size}.png`);
}

console.log('Icons generated in extension/icons/');
