#!/usr/bin/env node
/**
 * Live integration test: Streamline reference → Haiku Maayan realization.
 * Requires ANTHROPIC_API_KEY and STREAMLINE_API_KEY (or deployed BASE with proxies).
 *
 * Run locally with Vercel dev:
 *   npx vercel dev
 *   node memory-processor/scripts/test-pictogram-realize-live.js
 *
 * Or against deployment:
 *   BASE=https://your-app.vercel.app node memory-processor/scripts/test-pictogram-realize-live.js
 */
const path = require('path');
const fs = require('fs');

const BASE = (process.env.BASE || 'http://localhost:3000').replace(/\/$/, '');
const TERMS = ['bus', 'newspaper', 'grandfather'];

async function jsonFetch(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${body?.error?.message || res.statusText}`);
  return body;
}

function loadProvider() {
  const g = globalThis;
  const engineDir = path.join(__dirname, '../engine');
  const files = [
    'logger.js',
    'config.js',
    'anthropic-client.js',
    'rule3/pictogram-generate-prompt.js',
    'catalog/streamline-session.js',
    'catalog/providers/streamline.js',
    'catalog/providers/pictogram-realize.js',
    'catalog/resolve.js',
  ].map((f) => path.join(engineDir, f));

  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith('/api/')) {
      return origFetch(BASE + u, init);
    }
    return origFetch(url, init);
  };

  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(file, 'utf8'));
  });

  return g.MemoryEngineCatalogPictogramRealizeProvider;
}

async function main() {
  console.log(`Testing pictogram realization via ${BASE}\n`);
  const PR = loadProvider();
  PR.clearCache();

  for (const term of TERMS) {
    process.stdout.write(`  ${term} … `);
    const t0 = Date.now();
    const result = await PR.resolveIcon(term);
    const ms = Date.now() - t0;
    if (!result?.svg) {
      console.log('FAIL (no svg)');
      process.exitCode = 1;
      continue;
    }
    const valid = PR.validateMaayanSvg(result.svg);
    console.log(`${result.source} · ${valid.ok ? 'valid' : 'INVALID: ' + valid.reason} · ${ms}ms`);
    if (!valid.ok) process.exitCode = 1;
  }

  if (!process.exitCode) {
    console.log('\nLive pictogram realize test passed.');
  }
}

main().catch((err) => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
