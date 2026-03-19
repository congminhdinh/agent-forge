#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const targets = [
  'apps/web/.output',
  'apps/web/.nuxt',
  'apps/api/dist',
  'apps/api/coverage',
  'apps/api/.agentforge-api.sqlite',
];

const apply = process.argv.includes('--apply');
const existing = targets
  .map((target) => ({ target, absolutePath: path.join(repoRoot, target) }))
  .filter((entry) => fs.existsSync(entry.absolutePath));

if (existing.length === 0) {
  console.log('No generated Phase 1 artifacts found.');
  process.exit(0);
}

for (const entry of existing) {
  console.log(`${apply ? 'Removing' : 'Would remove'} ${entry.target}`);
  if (apply) {
    fs.rmSync(entry.absolutePath, { force: true, recursive: true });
  }
}

if (!apply) {
  console.log('Dry run complete. Re-run with --apply to delete these artifacts.');
}
