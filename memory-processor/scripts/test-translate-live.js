#!/usr/bin/env node
/**
 * Live translate test — run:
 *   node --env-file=.env.local memory-processor/scripts/test-translate-live.js
 */
const path = require('path');
const fs = require('fs');

const MEMORY = process.argv[2] || 'נסענו באופניים בכל יום כיפור לשחק פול בבר';

// Plausible representative words for this memory (Rule 1 style)
const WORDS = [
  { hebrew: 'נסענו', hint: 'travel', sourceText: 'נסענו', category: 'action' },
  { hebrew: 'אופניים', hint: 'bicycle', sourceText: 'באופניים', category: 'object' },
  { hebrew: 'יום כיפור', hint: 'yom kippur', sourceText: 'יום כיפור', category: 'time' },
  { hebrew: 'פול', hint: 'pool', sourceText: 'פול', category: 'object' },
  { hebrew: 'בר', hint: 'bar', sourceText: 'בבר', category: 'location' },
];

function loadTranslateModule() {
  const g = globalThis;
  const engineDir = path.join(__dirname, '../engine');
  g.fetch = async (url, opts) => {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    const body = JSON.parse(opts.body);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...body, model: 'claude-sonnet-4-20250514' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`API ${res.status}: ${data?.error?.message || res.statusText}`);
    return { ok: true, json: async () => data };
  };
  ['logger.js', 'anthropic-client.js', '../catalog/translate-words.js'].forEach((f) => {
    const p = f.startsWith('..') ? path.join(engineDir, f.slice(3)) : path.join(engineDir, f);
    eval(fs.readFileSync(p, 'utf8'));
  });
  return g.MemoryEngineCatalogTranslate;
}

async function main() {
  const Translate = loadTranslateModule();
  console.log('Memory:', MEMORY);
  console.log('Words:', WORDS.map((w) => w.hebrew).join(', '));
  console.log('---');
  const { translations } = await Translate.translateWords(WORDS, { memoryText: MEMORY });
  translations.forEach((t) => {
    console.log(`${t.hebrew} → ${t.english} (${t.source})`);
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
