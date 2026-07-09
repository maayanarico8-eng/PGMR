/**
 * Pictogram realize provider unit tests (Streamline reference → Haiku → cache).
 * Run: node memory-processor/engine/catalog/providers/pictogram-realize.test.js
 */
const path = require('path');
const fs = require('fs');

const VALID_SVG =
  '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#000000" stroke-width="1.0" stroke-linecap="round" stroke-linejoin="round"><path d="M12 32 L52 32" fill="none"/></svg>';

const REFERENCE_SVG = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20"/></svg>';

const CACHE_PATH = path.join(__dirname, '../../../pictograms/pictogram-cache.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}


function backupCache() {
  return fs.existsSync(CACHE_PATH) ? fs.readFileSync(CACHE_PATH, 'utf8') : null;
}

function restoreCache(backup) {
  if (backup != null) fs.writeFileSync(CACHE_PATH, backup, 'utf8');
  else if (fs.existsSync(CACHE_PATH)) fs.unlinkSync(CACHE_PATH);
}

function writeCacheFile(data) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function load() {
  const g = globalThis;
  const engineDir = path.join(__dirname, '../..');

  g.fetch = async (url, init) => {
    const u = String(url);
    const method = (init?.method || 'GET').toUpperCase();

    if (u.includes('/api/pictogram-cache') && method === 'GET') {
      return {
        ok: true,
        async json() {
          return g.__testPictogramCache || { version: 1, icons: {} };
        },
      };
    }
    if (u.includes('/api/pictogram-cache') && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      g.__testPictogramCache = g.__testPictogramCache || { version: 1, icons: {} };
      g.__testPictogramCache.icons[body.english] = body.entry;
      g.__testPictogramCachePosts = (g.__testPictogramCachePosts || 0) + 1;
      return { ok: true, async json() { return { ok: true, entry: body.entry }; } };
    }
    if (u.includes('/api/streamline-mapping') && !u.includes('action=')) {
      return { ok: true, async json() { return { version: 2, icons: {} }; } };
    }
    if (u.includes('action=family-search')) {
      if (/query=unicorn/i.test(u)) {
        return { ok: true, async json() { return { results: [] }; } };
      }
      return {
        ok: true,
        async json() {
          return { results: [{ hash: 'ico_bus', name: 'bus', isFree: true }] };
        },
      };
    }
    if (u.includes('action=download')) {
      return { ok: true, async json() { return { svg: REFERENCE_SVG }; } };
    }
    if (u.includes('/api/streamline-mapping') && method === 'POST') {
      return { ok: true, async json() { return { ok: true }; } };
    }
    if (u.includes('/api/anthropic')) {
      g.__testAnthropicCalls = (g.__testAnthropicCalls || 0) + 1;
      return {
        ok: true,
        async json() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  svg: VALID_SVG,
                  geometricDescription: 'simple horizontal line',
                }),
              },
            ],
          };
        },
      };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  const files = [
    'logger.js',
    'config.js',
    'anthropic-client.js',
    'rule3/pictogram-generate-prompt.js',
    'catalog/streamline-session.js',
    'catalog/providers/streamline.js',
    'catalog/providers/pictogram-realize.js',
  ].map((f) => path.join(engineDir, f));

  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(file, 'utf8'));
  });

  return g.MemoryEngineCatalogPictogramRealizeProvider;
}

function testValidator() {
  const PR = load();
  PR.clearCache();
  assert(PR.validateMaayanSvg(VALID_SVG).ok, 'valid svg should pass');
  assert(!PR.validateMaayanSvg('<svg viewBox="0 0 32 32"></svg>').ok, 'wrong viewBox should fail');
  assert(!PR.validateMaayanSvg('<svg viewBox="0 0 64 64"><path d="M0 0"/><path d="M1 1"/></svg>').ok, 'two paths should fail');
  console.log('PASS validator');
}

async function testCacheHit() {
  const backup = backupCache();
  writeCacheFile({
    version: 1,
    icons: { bus: { svg: VALID_SVG, streamlineHash: 'ico_bus' } },
  });

  const PR = load();
  PR.clearCache();
  globalThis.__testAnthropicCalls = 0;

  try {
    const result = await PR.resolveIcon('bus');
    assert(result?.source === 'cache', 'expected cache source');
    assert(result?.svg === VALID_SVG, 'expected cached svg');
    assert(globalThis.__testAnthropicCalls === 0, 'haiku should not run on cache hit');
    console.log('PASS cache hit');
  } finally {
    restoreCache(backup);
    load().clearCache();
  }
}

async function testStreamlineThenHaiku() {
  const backup = backupCache();
  writeCacheFile({ version: 1, icons: {} });

  const PR = load();
  PR.clearCache();
  globalThis.__testAnthropicCalls = 0;

  try {
    const result = await PR.resolveIcon('dog', { hebrew: 'כלב' });
    assert(result?.source === 'generated', 'expected generated source');
    assert(result?.svg?.includes('<path'), 'expected maayan svg');
    assert(globalThis.__testAnthropicCalls === 1, 'haiku should run once');

    const again = await PR.resolveIcon('dog');
    assert(again?.source === 'cache', 'second call should hit cache');
    assert(globalThis.__testAnthropicCalls === 1, 'haiku should not run again');
    console.log('PASS streamline reference → haiku → cache');
  } finally {
    restoreCache(backup);
    load().clearCache();
  }
}

async function testStreamlineMissFallback() {
  const backup = backupCache();
  writeCacheFile({ version: 1, icons: {} });

  const PR = load();
  PR.clearCache();
  globalThis.__testAnthropicCalls = 0;

  try {
    const result = await PR.resolveIcon('unicorn', { hebrew: 'חד קרן' });
    assert(result?.source === 'generated-fallback', 'expected fallback source');
    assert(result?.generationMode === 'fallback', 'expected fallback generation mode');
    assert(result?.svg?.includes('<path'), 'expected maayan svg');
    assert(globalThis.__testAnthropicCalls === 1, 'haiku should run once for fallback');
    console.log('PASS streamline miss → from-scratch fallback');
  } finally {
    restoreCache(backup);
    load().clearCache();
  }
}

async function run() {
  testValidator();
  await testCacheHit();
  await testStreamlineThenHaiku();
  await testStreamlineMissFallback();
  console.log('\nAll pictogram-realize tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
