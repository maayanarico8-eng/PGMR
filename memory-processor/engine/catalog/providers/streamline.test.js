/**
 * Streamline provider unit tests
 * Run: node memory-processor/engine/catalog/providers/streamline.test.js
 */
const path = require('path');
const fs = require('fs');

const FAMILY = 'streamline-regular';
const DOWNLOAD_PARAMS = {
  size: 64,
  responsive: true,
  strokeToFill: false,
  backgroundColor: '#ffffff00',
  colors: '#000000',
  strokeWidth: 0.5,
};
const SEARCH_PARAMS = { mode: 'family', familySlug: FAMILY, limit: 10 };

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
          return {
            version: 2,
            icons: {
              cat: {
                hash: 'ico_test',
                downloadParams: DOWNLOAD_PARAMS,
                searchParams: SEARCH_PARAMS,
              },
            },
          };
        },
      };
    }
    if (u.includes('/api/pictogram-cache?english=cat')) {
      return {
        ok: true,
        async json() {
          return {
            english: 'cat',
            entry: { svg: '<svg id="cached-cat"></svg>', hash: 'ico_test' },
          };
        },
      };
    }
    if (u.includes('/api/pictogram-cache') && !u.includes('english=')) {
      return { ok: true, async json() { return { version: 1, icons: {} }; } };
    }
    if (u.includes('action=download')) {
      return { ok: true, async json() { return { svg: '<svg id="downloaded"></svg>' }; } };
    }
    if (u.includes('action=family-search')) {
      return {
        ok: true,
        async json() {
          return { results: [{ hash: 'ico_new', name: 'dog' }] };
        },
      };
    }
    if (u.includes('/api/streamline-mapping') || u.includes('/api/pictogram-cache')) {
      return { ok: true, async json() { return { ok: true }; } };
    }
    throw new Error('unexpected fetch: ' + u);
  };

  eval(fs.readFileSync(path.join(__dirname, '../normalize-pictogram-svg.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../streamline-session.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, 'streamline.js'), 'utf8'));
  return g.MemoryEngineCatalogStreamlineProvider;
}

async function testCachedSvgSkipsDownload() {
  const SL = load();
  SL.clearMappingCache();
  const mappingPath = path.join(__dirname, '../../../pictograms/streamline-mapping.json');
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const mappingBackup = fs.existsSync(mappingPath) ? fs.readFileSync(mappingPath, 'utf8') : null;
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(
    mappingPath,
    JSON.stringify({
      version: 2,
      icons: {
        cat: {
          hash: 'ico_test',
          downloadParams: DOWNLOAD_PARAMS,
          searchParams: SEARCH_PARAMS,
        },
      },
    }, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      version: 1,
      icons: {
        cat: { svg: '<svg id="cached-cat"></svg>', hash: 'ico_test' },
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
  if (mappingBackup != null) fs.writeFileSync(mappingPath, mappingBackup, 'utf8');
  else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  assert(result?.svg?.includes('cached-cat'), 'expected cached svg');
  assert(result.source === 'cache', 'expected cache source');
  assert(!calls.some((c) => c.includes('action=family-search')), 'search should be skipped');
  assert(!calls.some((c) => c.includes('action=download')), 'download should be skipped when svg cached');
  console.log('PASS cached svg skips download');
}

async function testHashOnlyMappingDownloadsOnce() {
  const SL = load();
  SL.clearMappingCache();
  const mappingPath = path.join(__dirname, '../../../pictograms/streamline-mapping.json');
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const mappingBackup = fs.existsSync(mappingPath) ? fs.readFileSync(mappingPath, 'utf8') : null;
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(
    mappingPath,
    JSON.stringify({
      version: 2,
      icons: {
        cat: {
          hash: 'ico_test',
          downloadParams: DOWNLOAD_PARAMS,
          searchParams: SEARCH_PARAMS,
        },
      },
    }, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(cachePath, JSON.stringify({ version: 1, icons: {} }, null, 2) + '\n', 'utf8');

  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return orig(url);
  };

  const result = await SL.resolveIcon('cat');
  if (mappingBackup != null) fs.writeFileSync(mappingPath, mappingBackup, 'utf8');
  else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  assert(result?.svg?.includes('downloaded'), 'expected downloaded svg');
  assert(result.source === 'mapping', 'expected mapping source');
  assert(!calls.some((c) => c.includes('action=family-search')), 'search should be skipped for mapping hit');
  assert(calls.some((c) => c.includes('action=download')), 'download should run for hash-only entry');
  console.log('PASS hash-only mapping downloads once');
}

async function testSecondResolveUsesCache() {
  const SL = load();
  SL.clearMappingCache();
  const mappingPath = path.join(__dirname, '../../../pictograms/streamline-mapping.json');
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const mappingBackup = fs.existsSync(mappingPath) ? fs.readFileSync(mappingPath, 'utf8') : null;
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(
    mappingPath,
    JSON.stringify({
      version: 2,
      icons: {
        cat: {
          hash: 'ico_test',
          downloadParams: DOWNLOAD_PARAMS,
          searchParams: SEARCH_PARAMS,
        },
      },
    }, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      version: 1,
      icons: {
        cat: { svg: '<svg id="stored-cat"></svg>', hash: 'ico_test' },
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
  if (mappingBackup != null) fs.writeFileSync(mappingPath, mappingBackup, 'utf8');
  else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  assert(result?.svg?.includes('stored-cat'), 'expected stored svg from disk cache');
  assert(result.source === 'cache', 'expected cache source');
  assert(!calls.some((c) => c.includes('action=download')), 'download should be skipped on cache hit');
  console.log('PASS second resolve uses pictogram cache');
}

async function testMappingMiss() {
  const SL = load();
  SL.clearMappingCache();
  globalThis.MemoryEngineStreamlineSession?.cleanup?.();
  const mappingPath = path.join(__dirname, '../../../pictograms/streamline-mapping.json');
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const mappingBackup = fs.existsSync(mappingPath) ? fs.readFileSync(mappingPath, 'utf8') : null;
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(
    mappingPath,
    JSON.stringify({ version: 2, meta: { searchMode: 'family', familySlug: FAMILY }, icons: {} }, null, 2) + '\n',
    'utf8'
  );
  fs.writeFileSync(cachePath, JSON.stringify({ version: 1, icons: {} }, null, 2) + '\n', 'utf8');
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return orig(url);
  };

  const result = await SL.resolveIcon('dog');
  if (mappingBackup != null) fs.writeFileSync(mappingPath, mappingBackup, 'utf8');
  else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  assert(result?.svg, 'expected svg');
  assert(result.source === 'streamline-new', 'expected new source');
  assert(calls.some((c) => c.includes('action=family-search')), 'search should run on miss');
  assert(calls.some((c) => c.includes('action=download')), 'download should run on miss');
  console.log('PASS mapping miss searches and saves');
}

async function testConcurrentBankSavesPersistAll() {
  const SL = load();
  SL.clearMappingCache();
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(cachePath, JSON.stringify({ version: 1, icons: {} }, null, 2) + '\n', 'utf8');

  const icons = [
    { english: 'bicycle', svg: '<svg id="bicycle"></svg>', hash: 'h1' },
    { english: 'yom kippur', svg: '<svg id="yom-kippur"></svg>', hash: 'h2' },
    { english: 'billiards', svg: '<svg id="billiards"></svg>', hash: 'h3' },
    { english: 'bar', svg: '<svg id="bar"></svg>', hash: 'h4' },
  ];

  await Promise.all(icons.map((icon) => SL.saveCacheEntry(icon.english, icon)));

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  icons.forEach((icon) => {
    const key = icon.english.toLowerCase();
    assert(cache.icons?.[key]?.svg?.includes(icon.english.replace(/\s+/g, '-')), `expected ${key} in bank`);
  });

  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  console.log('PASS concurrent bank saves persist all icons');
}

async function testEnsureBankedIconsBatchSkipsExisting() {
  const SL = load();
  SL.clearMappingCache();
  const cachePath = path.join(__dirname, '../../../pictograms/pictogram-cache.json');
  const cacheBackup = fs.existsSync(cachePath) ? fs.readFileSync(cachePath, 'utf8') : null;
  fs.writeFileSync(
    cachePath,
    JSON.stringify(
      {
        version: 1,
        icons: {
          bicycle: { svg: '<svg id="existing-bicycle"></svg>', hash: 'keep' },
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  const result = await SL.ensureBankedIcons([
    { english: 'bicycle', svg: '<svg id="new-bicycle"></svg>', hash: 'new' },
    { english: 'bar', svg: '<svg id="bar"></svg>', hash: 'h4' },
  ]);

  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  assert(cache.icons.bicycle.svg.includes('existing-bicycle'), 'existing bicycle kept');
  assert(cache.icons.bar?.svg?.includes('bar'), 'bar added');
  assert(result.saved.includes('bar'), 'only bar reported saved');

  if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
  else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
  SL.clearMappingCache();
  console.log('PASS ensureBankedIcons skips existing and batch-saves missing');
}

async function run() {
  await testCachedSvgSkipsDownload();
  await testHashOnlyMappingDownloadsOnce();
  await testSecondResolveUsesCache();
  await testMappingMiss();
  await testConcurrentBankSavesPersistAll();
  await testEnsureBankedIconsBatchSkipsExisting();
  console.log('\nAll streamline provider tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
