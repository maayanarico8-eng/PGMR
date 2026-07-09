/**
 * Golden test — full local pipeline (Rule 1 → 2 → 3) + pictogram realization resolution.
 * Run: node memory-processor/engine/pipeline.test.js
 */
const path = require('path');
const fs = require('fs');

const VALID_SVG =
  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#000000" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 32 L52 32" fill="none"/></svg>';

function loadEngine() {
  const g = globalThis;
  const engineDir = path.join(__dirname);

  g.fetch = async (url, init) => {
    const u = String(url);
    const method = (init?.method || 'GET').toUpperCase();

    if (u.includes('/api/pictogram-cache') && method === 'GET') {
      return { ok: true, async json() { return { version: 1, icons: {} }; } };
    }
    if (u.includes('/api/pictogram-cache') && method === 'POST') {
      return { ok: true, async json() { return { ok: true }; } };
    }
    if (u.includes('/api/streamline-mapping') && !u.includes('action=')) {
      return { ok: true, async json() { return { version: 1, icons: {} }; } };
    }
    if (u.includes('action=family-search')) {
      return {
        ok: true,
        async json() {
          return { results: [{ hash: 'ico_grandfather', name: 'grandfather', isFree: true }] };
        },
      };
    }
    if (u.includes('action=download')) {
      return { ok: true, async json() { return { svg: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="16"/></svg>' }; } };
    }
    if (u.includes('/api/streamline-mapping') && method === 'POST') {
      return { ok: true, async json() { return { ok: true }; } };
    }
    if (u.includes('/api/anthropic')) {
      return {
        ok: true,
        async json() {
          return {
            content: [{ type: 'text', text: JSON.stringify({ svg: VALID_SVG, geometricDescription: 'test' }) }],
          };
        },
      };
    }
    throw new Error('unexpected fetch in pipeline test: ' + u);
  };

  const files = [
    'logger.js',
    'config.js',
    'catalog/entries.js',
    'catalog/index.js',
    'catalog/providers/local.js',
    'anthropic-client.js',
    'rule3/pictogram-generate-prompt.js',
    'catalog/streamline-session.js',
    'catalog/providers/streamline.js',
    'catalog/providers/pictogram-realize.js',
    'catalog/providers/external.js',
    'catalog/resolve.js',
    'catalog/translate-words.js',
    'rule1/extract-event-model.js',
    'rule1/stages.js',
    'rule1/index.js',
    'rule2/vrp.js',
    'rule3/lookup.js',
    'pipeline.js',
    'index.js',
  ].map((f) => path.join(engineDir, f));
  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(file, 'utf8'));
  });
  return g.MemoryEngine;
}

const MOCK_MEMORY = 'בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד.';

async function testPictogramResolution() {
  const resolved = await globalThis.MemoryEngine.resolvePictogram('סבא', { english: 'grandfather' });
  if (resolved.status !== 'hit' || !resolved.svg) {
    throw new Error('resolvePictogram for סבא failed');
  }
  if (resolved.hebrew !== 'סבא' || resolved.english !== 'grandfather') {
    throw new Error('resolvePictogram should return hebrew + english pair');
  }
  if (!['generated', 'cache', 'generated-fallback'].includes(resolved.source)) {
    throw new Error('expected generated, cache, or generated-fallback source, got ' + resolved.source);
  }

  console.log('Pictogram resolution: grandfather OK');
}

async function main() {
  const engine = loadEngine();
  const out = engine.runPipeline(MOCK_MEMORY);

  if (!out.supported) {
    console.error('FAIL: pipeline unsupported:', out.reason);
    process.exit(1);
  }

  const words = out.words || [];
  const expectedWords = ['סבא', 'מספר/ת', 'קריאת עיתון', 'עיתון', 'שירה ביחד'];
  const missing = expectedWords.filter((w) => !words.includes(w));
  if (missing.length) {
    console.error('FAIL: missing representative words:', missing.join(', '));
    process.exit(1);
  }

  if (out.rule1.consistencyGateStatus !== 'pass') {
    console.error('FAIL: consistency gate should pass');
    process.exit(1);
  }

  const vrpModes = (out.rule2?.vrp || []).map((u) => `${u.unit}:${u.phase2?.modeDecision?.mode}`);
  console.log('VRP modes:', vrpModes.join(', '));

  const hits = (out.rule3?.lookups || []).filter((l) => l.outcome === 'hit');
  const gaps = (out.rule3?.lookups || []).filter((l) => l.outcome === 'gap');
  console.log('Catalog hits:', hits.map((l) => l.hebrew).join(', ') || '(none)');
  console.log('Visual gaps:', gaps.map((l) => l.hebrew).join(', ') || '(none)');

  const sabaHit = hits.find((l) => l.hebrew === 'סבא');
  if (!sabaHit || sabaHit.english !== 'grandfather') {
    console.error('FAIL: סבא lookup should include english=grandfather, got', sabaHit?.english);
    process.exit(1);
  }

  if (!hits.map((l) => l.hebrew).includes('סבא') || !hits.map((l) => l.hebrew).includes('עיתון')) {
    console.error('FAIL: expected catalog hits for סבא and עיתון');
    process.exit(1);
  }

  const hitSources = (out.rule3?.lookups || []).filter((l) => l.outcome === 'hit').map((l) => l.source);
  if (!hitSources.every((s) => s === 'cache' || s === 'generated' || s === 'generated-fallback')) {
    console.error('FAIL: catalog hits should have source=cache, generated, or generated-fallback');
    process.exit(1);
  }

  const eventTypes = (out.trace?.events || []).map((e) => e.type);
  if (!eventTypes.includes('CATALOG_HIT')) {
    console.error('FAIL: trace should include CATALOG_HIT events');
    process.exit(1);
  }
  if (!eventTypes.includes('VRP_MODE')) {
    console.error('FAIL: trace should include VRP_MODE events');
    process.exit(1);
  }

  await testPictogramResolution();

  console.log('Trace events:', out.trace?.summary?.total || 0);
  console.log('PASS: full pipeline golden test');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
