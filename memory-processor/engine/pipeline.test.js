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
    'catalog/providers/local.js',
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

async function testBankResolution() {
  const entry = globalThis.MemoryEngineCatalog.lookup('סבא');
  if (!entry || entry.id !== 'CAT-0001') {
    throw new Error('catalog lookup for סבא failed');
  }

  const svg = await globalThis.MemoryEngineCatalogLocalProvider.loadByWord('סבא');
  if (!svg || !svg.includes('<svg')) {
    throw new Error('bank SVG load for סבא failed');
  }

  const resolved = await globalThis.MemoryEngine.resolvePictogram('סבא', { english: 'grandfather' });
  if (resolved.status !== 'hit' || resolved.source !== 'bank' || !resolved.svg) {
    throw new Error('resolvePictogram for סבא failed');
  }
  if (resolved.hebrew !== 'סבא' || resolved.english !== 'grandfather') {
    throw new Error('resolvePictogram should return hebrew + english pair');
  }

  const hits = (await globalThis.MemoryEngineCatalogResolve.resolveForWord('עיתון'));
  if (hits.status !== 'hit' || hits.assetRef !== 'עיתון.svg') {
    throw new Error('resolveForWord assetRef mismatch for עיתון');
  }

  console.log('Bank resolution: סבא.svg OK');
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
  if (!hitSources.every((s) => s === 'bank')) {
    console.error('FAIL: catalog hits should have source=bank');
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

  await testBankResolution();

  console.log('Trace events:', out.trace?.summary?.total || 0);
  console.log('PASS: full pipeline golden test');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
