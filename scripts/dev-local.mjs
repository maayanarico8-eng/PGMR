#!/usr/bin/env node
/**
 * Local-only vercel dev: loads .env.local into the process and starts
 * `vercel dev --local` so cloud/project env vars are not preferred.
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.local');

if (!existsSync(envPath)) {
  console.error('Missing .env.local — copy .env.example and add your keys.');
  process.exit(1);
}

const env = { ...process.env };
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const s = line.trim();
  if (!s || s.startsWith('#') || !s.includes('=')) continue;
  const i = s.indexOf('=');
  const key = s.slice(0, i).trim();
  let val = s.slice(i + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (key) env[key] = val;
}

for (const key of ['ANTHROPIC_API_KEY', 'STREAMLINE_API_KEY']) {
  if (!env[key]?.trim()) {
    console.warn(`Warning: ${key} is empty in .env.local`);
  }
}

const child = spawn(
  'npx',
  ['vercel', 'dev', '--listen', '3000', '--yes', '--local'],
  { cwd: root, env, stdio: 'inherit', shell: true }
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
