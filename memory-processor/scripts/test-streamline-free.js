#!/usr/bin/env node
/**
 * Verify Streamline family search (streamline-regular) returns downloadable SVGs.
 * Run: BASE=https://pgmr-two.vercel.app node memory-processor/scripts/test-streamline-free.js
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const FAMILY = 'streamline-regular';
const WORDS = ['cat', 'grandfather', 'pool', 'pool swing', 'newspaper'];

async function search(word) {
  const qs = new URLSearchParams({
    action: 'family-search',
    familySlug: FAMILY,
    query: word,
    limit: '5',
  });
  const res = await fetch(`${BASE}/api/streamline?${qs}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || `search failed ${res.status}`);
  return body.results || [];
}

async function download(hash) {
  const qs = new URLSearchParams({
    action: 'download',
    hash,
    size: '64',
    responsive: 'true',
    backgroundColor: '#ffffff00',
    colors: '#000000',
    strokeWidth: '0.5',
  });
  const res = await fetch(`${BASE}/api/streamline?${qs}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || `download failed ${res.status}`);
  return body.svg;
}

async function testWord(word) {
  const results = await search(word);
  if (!results.length) {
    console.log(`FAIL ${word}: no search results`);
    return false;
  }
  const summary = results.map((r) => `${r.name}(free=${r.isFree})`).join(', ');
  for (const icon of results) {
    try {
      const svg = await download(icon.hash);
      const ok = svg && svg.includes('<svg');
      console.log(`${ok ? 'PASS' : 'FAIL'} ${word}: ${icon.name} hash=${icon.hash.slice(0, 18)}… svg=${svg?.length || 0}b`);
      if (ok) return true;
    } catch (err) {
      console.log(`skip ${word}: ${icon.name} — ${err.message}`);
    }
  }
  console.log(`FAIL ${word}: none downloadable. candidates: ${summary}`);
  return false;
}

async function main() {
  console.log(`Testing Streamline family ${FAMILY} via ${BASE}\n`);
  let passed = 0;
  for (const word of WORDS) {
    if (await testWord(word)) passed++;
  }
  console.log(`\n${passed}/${WORDS.length} words resolved`);
  if (passed === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
