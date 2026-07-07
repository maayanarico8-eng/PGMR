/**
 * Streamline provider unit tests
 * Run: node memory-processor/engine/catalog/providers/streamline.test.js
 */
const path = require('path');
const fs = require('fs');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function load() {
  const g = globalThis;
  g.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/streamline-mapping') && !u.includes('action=')) {
      return {
        ok: true,
        async json() {
          return { version: 1, icons: { cat: { hash: 'ico_test', downloadParams: { size: 64, responsive: true, strokeToFill: false } } } };
        },
      };
    }
    if (u.includes('action=download')) {
      return { ok: true, async json() { return { svg: '<svg id="mapped"></svg>' }; } };
    }
    if (u.includes('action=search')) {
      return {
        ok: true,
        async json() {
          return { results: [{ hash: 'ico_new', name: 'dog' }] };
        },
      };
    }
    if (u.includes('/api/streamline-mapping')) {
      return { ok: true, async json() { return { ok: true }; } };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  eval(fs.readFileSync(path.join(__dirname, '../streamline-session.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, 'streamline.js'), 'utf8'));
  return g.MemoryEngineCatalogStreamlineProvider;
}

async function testMappingHit() {
  const SL = load();
  SL.clearMappingCache();
  const mappingPath = path.join(__dirname, '../../../pictograms/streamline-mapping.json');
  const backup = fs.existsSync(mappingPath) ? fs.readFileSync(mappingPath, 'utf8') : null;
  fs.writeFileSync(
    mappingPath,
    JSON.stringify({
      version: 1,
      icons: {
        cat: {
          hash: 'ico_test',
          downloadParams: { size: 64, responsive: true, strokeToFill: false },
        },
      },
    }, null, 2) + '\n',
    'utf8'
  );
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return orig(url);
  };

  const result = await SL.resolveIcon('cat');
  if (backup != null) fs.writeFileSync(mappingPath, backup, 'utf8');
  else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
  SL.clearMappingCache();
  assert(result?.svg?.includes('mapped'), 'expected mapped svg');
  assert(result.source === 'mapping', 'expected mapping source');
  assert(!calls.some((c) => c.includes('action=search')), 'search should be skipped for mapping hit');
  assert(calls.some((c) => c.includes('action=download')), 'download should run');
  console.log('PASS mapping hit skips search');
}

async function testMappingMiss() {
  const SL = load();
  SL.clearMappingCache();
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return orig(url);
  };

  const result = await SL.resolveIcon('dog');
  assert(result?.svg, 'expected svg');
  assert(result.source === 'streamline-new', 'expected new source');
  assert(calls.some((c) => c.includes('action=search')), 'search should run on miss');
  console.log('PASS mapping miss searches and saves');
}

async function run() {
  await testMappingHit();
  await testMappingMiss();
  console.log('\nAll streamline provider tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
