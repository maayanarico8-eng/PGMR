/**
 * Golden test — full local pipeline (Rule 1 → 2 → 3) + pictogram bank resolution.
 * Run: node memory-processor/engine/pipeline.test.js
 */
const path = require('path');
const fs = require('fs');

function loadEngine() {
  const g = globalThis;
  const engineDir = path.join(__dirname);
  const files = [
    'logger.js',
    'config.js',
    'catalog/entries.js',
    'catalog/index.js',
    'catalog/normalize-pictogram-svg.js',
    'catalog/providers/local.js',
    'catalog/streamline-session.js',
    'anthropic-client.js',
    'catalog/select-pictogram-prompt.js',
    'catalog/select-pictogram.js',
    'catalog/providers/streamline.js',
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

async function testStreamlineResolution() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/streamline-mapping') && !u.includes('action=')) {
      return { ok: true, async json() { return { version: 1, icons: {} }; } };
    }
    if (u.includes('/api/pictogram-cache')) {
      return { ok: true, async json() { return { english: '', entry: null }; } };
    }
    if (u.includes('action=family-search')) {
      return {
        ok: true,
        async json() {
          return { results: [{ hash: 'ico_grandfather', name: 'grandfather' }] };
        },
      };
    }
    if (u.includes('action=preview')) {
      return {
        ok: true,
        async json() {
          return { hash: 'ico_grandfather', mediaType: 'image/png', data: 'aa' };
        },
      };
    }
    if (u.includes('action=download')) {
      return { ok: true, async json() { return { svg: '<svg></svg>' }; } };
    }
    if (u.includes('/api/anthropic')) {
      return {
        ok: true,
        async json() {
          return {
            content: [
              {
                type: 'text',
                text: '{"winnerHash":"ico_grandfather","winnerIndex":0,"rationale":"test"}',
              },
            ],
          };
        },
      };
    }
    if (u.includes('/api/streamline-mapping')) {
      return { ok: true, async json() { return { ok: true }; } };
    }
    throw new Error('unexpected fetch in pipeline test: ' + u);
  };

  const resolved = await globalThis.MemoryEngine.resolvePictogram('סבא', { english: 'grandfather' });
  if (resolved.status !== 'hit' || !resolved.svg) {
    throw new Error('resolvePictogram for סבא failed');
  }
  if (resolved.hebrew !== 'סבא' || resolved.english !== 'grandfather') {
    throw new Error('resolvePictogram should return hebrew + english pair');
  }

  console.log('Streamline resolution: grandfather OK');
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
  if (!hitSources.every((s) => s === 'cache' || s === 'mapping' || s === 'streamline')) {
    console.error('FAIL: catalog hits should have source=cache, mapping, or streamline');
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

  await testStreamlineResolution();

  console.log('Trace events:', out.trace?.summary?.total || 0);
  console.log('PASS: full pipeline golden test');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
