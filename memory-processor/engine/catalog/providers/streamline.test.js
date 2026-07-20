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

function load(opts) {
  const g = globalThis;
  delete g.MemoryEngineCatalogStreamlineProvider;
  delete g.MemoryEngineCatalogLocalProvider;
  delete g.MemoryEngineSelectPictogram;
  delete g.MemoryEngineSelectPictogramPrompt;
  delete g.MemoryEngineAnthropic;
  delete g.MemoryEngineStreamlineSession;
  delete g.MemoryEngineNormalizePictogramSvg;

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
    if (u.includes('action=preview')) {
      return {
        ok: true,
        async json() {
          return { hash: 'preview', mediaType: 'image/png', data: 'aaa' };
        },
      };
    }
    if (u.includes('action=download')) {
      const hashMatch = /[?&]hash=([^&]+)/.exec(u);
      const hash = hashMatch ? decodeURIComponent(hashMatch[1]) : 'unknown';
      return {
        ok: true,
        async json() {
          return { svg: `<svg id="downloaded-${hash}"></svg>` };
        },
      };
    }
    if (u.includes('action=family-search')) {
      return {
        ok: true,
        async json() {
          return {
            results: opts?.searchResults || [
              {
                hash: 'ico_new',
                name: 'dog',
                isFree: true,
                imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/dog.png?_a=1',
              },
            ],
          };
        },
      };
    }
    if (u.includes('/api/streamline-mapping') || u.includes('/api/pictogram-cache')) {
      return { ok: true, async json() { return { ok: true }; } };
    }
    if (u.includes('/api/anthropic')) {
      throw new Error('anthropic should be mocked via MemoryEngineAnthropic');
    }
    throw new Error('unexpected fetch: ' + u);
  };

  eval(fs.readFileSync(path.join(__dirname, '../normalize-pictogram-svg.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../streamline-session.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../../anthropic-client.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../select-pictogram-prompt.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '../select-pictogram.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, 'streamline.js'), 'utf8'));

  if (opts?.selectWinnerHash) {
    g.MemoryEngineSelectPictogram = {
      selectPictogramFromCandidates: async () => ({
        winnerHash: opts.selectWinnerHash,
        winnerIndex: 1,
        rationale: 'test',
      }),
    };
  }
  if (opts?.selectError) {
    g.MemoryEngineSelectPictogram = {
      selectPictogramFromCandidates: async () => {
        throw new Error(opts.selectError);
      },
    };
  }
  if (opts?.disableSelect) {
    delete g.MemoryEngineSelectPictogram;
  }

  return g.MemoryEngineCatalogStreamlineProvider;
}

function withEmptyBank(fn) {
  return async () => {
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
    try {
      await fn({ mappingPath, cachePath });
    } finally {
      if (mappingBackup != null) fs.writeFileSync(mappingPath, mappingBackup, 'utf8');
      else if (fs.existsSync(mappingPath)) fs.unlinkSync(mappingPath);
      if (cacheBackup != null) fs.writeFileSync(cachePath, cacheBackup, 'utf8');
      else if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    }
  };
}

async function testCachedSvgSkipsDownload() {
  const SL = load({ disableSelect: true });
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
  const SL = load({ disableSelect: true });
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
  const SL = load({ disableSelect: true });
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
  await withEmptyBank(async () => {
    const SL = load({ disableSelect: true });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();
    const calls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return orig(url);
    };

    const result = await SL.resolveIcon('dog');
    SL.clearMappingCache();
    assert(result?.svg, 'expected svg');
    assert(result.source === 'streamline-new', 'expected new source');
    assert(calls.some((c) => c.includes('action=family-search')), 'search should run on miss');
    assert(calls.some((c) => c.includes('action=download')), 'download should run on miss');
    console.log('PASS mapping miss searches and saves');
  })();
}

async function testAiSelectsNonFirstHash() {
  await withEmptyBank(async () => {
    const searchResults = [
      {
        hash: 'ico_first',
        name: 'pool table',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/a.png?_a=1',
      },
      {
        hash: 'ico_winner',
        name: 'swimming pool',
        isFree: false,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/b.png?_a=1',
      },
      {
        hash: 'ico_third',
        name: 'pool',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/c.png?_a=1',
      },
    ];
    const SL = load({ searchResults, selectWinnerHash: 'ico_winner' });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();

    const downloadHashes = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('action=download')) {
        const m = /[?&]hash=([^&]+)/.exec(u);
        downloadHashes.push(m ? decodeURIComponent(m[1]) : '');
      }
      return orig(u);
    };

    const result = await SL.resolveIcon('swimming pool');
    SL.clearMappingCache();
    assert(result?.hash === 'ico_winner', 'expected AI-selected hash');
    assert(result?.svg?.includes('ico_winner'), 'expected winner svg body');
    assert(downloadHashes[0] === 'ico_winner', 'first download should be the AI winner');
    assert(downloadHashes.length === 1, 'should download only the winner');
    console.log('PASS AI selection downloads non-first hash');
  })();
}

async function testRankDoesNotPreferFree() {
  const SL = load({ disableSelect: true });
  const ranked = SL.rankIconCandidates(
    [
      { hash: 'prem', name: 'cat sitting', isFree: false },
      { hash: 'free', name: 'cat', isFree: true },
    ],
    'kitten',
    FAMILY
  );
  assert(ranked[0].hash === 'prem', 'premium first in API order is kept (no free filter)');
  assert(ranked.length === 2, 'both candidates kept');

  const exact = SL.rankIconCandidates(
    [
      { hash: 'prem', name: 'cat sitting', isFree: false },
      { hash: 'exact', name: 'cat', isFree: true },
    ],
    'cat',
    FAMILY
  );
  assert(exact[0].hash === 'exact', 'exact name still bumped for fallback');
  console.log('PASS rankIconCandidates no longer prefers free');
}

async function testSelectErrorFallsBack() {
  await withEmptyBank(async () => {
    const searchResults = [
      {
        hash: 'ico_a',
        name: 'dog',
        isFree: false,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/a.png?_a=1',
      },
      {
        hash: 'ico_b',
        name: 'puppy',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/b.png?_a=1',
      },
    ];
    const SL = load({ searchResults, selectError: 'claude unavailable' });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();

    const result = await SL.resolveIcon('dog');
    SL.clearMappingCache();
    assert(result?.hash === 'ico_a', 'fallback should use exact-name / first ordered candidate');
    assert(result.source === 'streamline-new', 'expected streamline-new');
    console.log('PASS AI selection error falls back to ranked order');
  })();
}

async function testResolvePreviewUrl() {
  const SL = load({ disableSelect: true });
  assert(
    SL.resolvePreviewUrl('icons/foo.png/bar') === 'https://cdn-icons.streamlinehq.com/icons/foo.png/bar',
    'relative path becomes CDN url'
  );
  assert(
    SL.resolvePreviewUrl('https://assets.streamlinehq.com/image/private/w_68,h_68/x.png?_a=1') ===
      'https://assets.streamlinehq.com/image/private/w_68,h_68/x.png?_a=1',
    'absolute url preserved'
  );
  assert(SL.resolvePreviewUrl('') === null, 'empty → null');
  console.log('PASS resolvePreviewUrl');
}

async function testLoadCandidateImagesPrefersUrl() {
  const g = globalThis;
  eval(fs.readFileSync(path.join(__dirname, '../select-pictogram.js'), 'utf8'));
  const Select = g.MemoryEngineSelectPictogram;
  let previewCalls = 0;
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('action=preview')) {
      previewCalls++;
      return {
        ok: true,
        async json() {
          return { hash: 'ico_b', mediaType: 'image/png', data: 'bbb' };
        },
      };
    }
    throw new Error('unexpected fetch in prefer-url test: ' + u);
  };

  const imaged = await Select.loadCandidateImages([
    {
      hash: 'ico_a',
      name: 'Family Walk Park',
      previewUrl:
        'https://assets.streamlinehq.com/image/private/w_68,h_68,ar_1/f_auto/v1/icons/x.png?_a=1',
    },
    { hash: 'ico_b', name: 'no url' },
  ]);

  globalThis.fetch = prevFetch;
  assert(imaged.length === 2, 'both candidates loaded');
  assert(imaged[0].image.kind === 'url', 'first uses url kind');
  assert(imaged[0].image.url.includes('assets.streamlinehq.com'), 'uses CDN preview url');
  assert(imaged[1].image.kind === 'base64', 'missing url falls back to base64');
  assert(previewCalls === 1, 'PNG download fallback only for missing url');
  console.log('PASS loadCandidateImages prefers imagePreviewUrl');
}

async function testConcurrentBankSavesPersistAll() {
  const SL = load({ disableSelect: true });
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
  const SL = load({ disableSelect: true });
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

/** Unit tests must never hit live Anthropic — selection is a local stub only. */
function assertNoAnthropic(anthropicCalls) {
  assert(anthropicCalls === 0, 'unit test must not call Anthropic /api/anthropic');
}

async function testExcludeHashesSkipsAlreadyUsedIcon() {
  await withEmptyBank(async () => {
    const searchResults = [
      {
        hash: 'ico_shared',
        name: 'picture frame',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/a.png?_a=1',
      },
      {
        hash: 'ico_alt',
        name: 'assemble furniture',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/b.png?_a=1',
      },
    ];
    // Local stub always prefers ico_shared; exclusion must force the alternate. No Anthropic.
    const SL = load({ searchResults, selectWinnerHash: 'ico_shared' });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();
    globalThis.MemoryEngineAnthropic = {
      callClaudeJSON: async () => {
        throw new Error('unit test must not call Anthropic');
      },
    };

    let anthropicFetches = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/api/anthropic')) anthropicFetches++;
      return orig(url);
    };

    const first = await SL.resolveIcon('picture frame');
    assert(first?.hash === 'ico_shared', 'first word takes shared hash');
    assert(
      globalThis.MemoryEngineStreamlineSession.getUsedHashes().includes('ico_shared'),
      'session tracks used hash'
    );

    const second = await SL.resolveIcon('assemble furniture', {
      excludeHashes: globalThis.MemoryEngineStreamlineSession.getUsedHashes(),
    });
    globalThis.fetch = orig;
    assertNoAnthropic(anthropicFetches);
    assert(second?.hash === 'ico_alt', 'second word must not reuse shared hash');
    assert(second?.hash !== first.hash, 'hashes unique within run');
    console.log('PASS excludeHashes prevents duplicate pictogram in one run');
  })();
}

async function testCachedHashExcludedForcesResearch() {
  await withEmptyBank(async ({ cachePath }) => {
    const searchResults = [
      {
        hash: 'ico_cached',
        name: 'hang picture',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/a.png?_a=1',
      },
      {
        hash: 'ico_other',
        name: 'hang coat',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/b.png?_a=1',
      },
    ];
    // Local stub only — no Anthropic.
    const SL = load({ searchResults, selectWinnerHash: 'ico_other' });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();
    globalThis.MemoryEngineAnthropic = {
      callClaudeJSON: async () => {
        throw new Error('unit test must not call Anthropic');
      },
    };

    let anthropicFetches = 0;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/api/anthropic')) anthropicFetches++;
      return orig(url);
    };

    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          version: 1,
          icons: {
            'hang picture': { svg: '<svg id="ico_cached"></svg>', hash: 'ico_cached' },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const result = await SL.resolveIcon('hang picture', { excludeHashes: ['ico_cached'] });
    globalThis.fetch = orig;
    assertNoAnthropic(anthropicFetches);
    assert(result?.hash === 'ico_other', 'excluded cache hash forces new search pick');
    assert(result?.source === 'streamline-new', 'expected search path');
    console.log('PASS excluded cache hash forces re-search');
  })();
}

async function testEmptyStateFallbackOnStreamlineMiss() {
  await withEmptyBank(async ({ mappingPath, cachePath }) => {
    const EMPTY_SVG = '<svg id="empty-state-bank"></svg>';
    const SL = load({ disableSelect: true, searchResults: [] });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();

    globalThis.MemoryEngineCatalogLocalProvider = {
      loadByWord: async (word) => (word === 'empty state' ? EMPTY_SVG : null),
    };

    const persistCalls = [];
    const orig = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (init?.method && init.method !== 'GET') {
        persistCalls.push({ url: u, method: init.method, body: init.body });
      }
      return orig(u, init);
    };

    const phases = [];
    const result = await SL.resolveIcon('unicorn', {
      trace: (step) => phases.push(step.phase),
    });
    globalThis.fetch = orig;

    assert(result?.source === 'bank-fallback', 'expected bank-fallback source');
    assert(result?.english === 'unicorn', 'slot keeps original english');
    assert(result?.svg?.includes('empty-state-bank'), 'expected empty state svg');
    assert(result?.hash === 'bank:unicorn', 'stable hash rewrites shared empty-state sentinel per term');
    assert(phases.includes('streamline-miss'), 'should miss streamline search');
    assert(phases.includes('empty-state-fallback'), 'should record empty-state-fallback');

    const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert(!mapping.icons?.unicorn, 'must not write streamline mapping for original term');
    assert(!cache.icons?.unicorn, 'must not write pictogram cache for original term');
    assert(
      !persistCalls.some((c) => c.url.includes('/api/streamline-mapping') || c.url.includes('/api/pictogram-cache')),
      'must not persist mapping/cache for fallback'
    );
    console.log('PASS empty-state fallback on streamline miss');
  })();
}

async function testEmptyStateFallbackMissingReturnsNull() {
  await withEmptyBank(async () => {
    const SL = load({ disableSelect: true, searchResults: [] });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();

    globalThis.MemoryEngineCatalogLocalProvider = {
      loadByWord: async () => null,
    };

    const result = await SL.resolveIcon('unicorn');
    assert(result == null, 'missing empty-state bank asset should still gap');
    console.log('PASS empty-state fallback missing returns null');
  })();
}

async function testEmptyStateFallbackReusableAcrossTerms() {
  await withEmptyBank(async () => {
    const EMPTY_SVG = '<svg id="empty-state-bank"></svg>';
    const SL = load({ disableSelect: true, searchResults: [] });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();

    globalThis.MemoryEngineCatalogLocalProvider = {
      loadByWord: async (word) => (word === 'empty state' ? EMPTY_SVG : null),
    };

    const first = await SL.resolveIcon('alpha');
    const second = await SL.resolveIcon('beta', {
      excludeHashes: globalThis.MemoryEngineStreamlineSession.getUsedHashes(),
    });

    assert(first?.source === 'bank-fallback', 'first fallback hit');
    assert(second?.source === 'bank-fallback', 'second fallback hit despite shared sentinel');
    assert(first?.hash === 'bank:alpha' && second?.hash === 'bank:beta', 'unique per-term hashes');
    assert(SL.SHARED_HASH_SENTINELS.has('bank:empty state'), 'empty state hash is shared sentinel');
    console.log('PASS empty-state fallback reusable across terms');
  })();
}

async function testManualUploadHashDoesNotBlockOtherBankTerms() {
  await withEmptyBank(async ({ cachePath }) => {
    const searchResults = [
      {
        hash: 'ico_streamline_grandpa',
        name: 'grandfather',
        isFree: true,
        imagePreviewUrl: 'https://assets.streamlinehq.com/image/private/g.png?_a=1',
      },
    ];
    const SL = load({ searchResults, selectWinnerHash: 'ico_streamline_grandpa' });
    SL.clearMappingCache();
    globalThis.MemoryEngineStreamlineSession?.cleanup?.();
    globalThis.MemoryEngineAnthropic = {
      callClaudeJSON: async () => {
        throw new Error('unit test must not call Anthropic');
      },
    };

    // Simulate bulk bank import: many terms share sentinel hash "manual-upload"
    fs.writeFileSync(
      cachePath,
      JSON.stringify(
        {
          version: 1,
          icons: {
            girl: { svg: '<svg id="bank-girl"></svg>', hash: 'manual-upload' },
            grandfather: { svg: '<svg id="bank-grandfather"></svg>', hash: 'manual-upload' },
          },
        },
        null,
        2
      )
    );

    let searched = false;
    const orig = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('action=search')) searched = true;
      if (u.includes('/api/pictogram-cache?english=girl')) {
        return {
          ok: true,
          async json() {
            return { english: 'girl', entry: { svg: '<svg id="bank-girl"></svg>', hash: 'manual-upload' } };
          },
        };
      }
      if (u.includes('/api/pictogram-cache?english=grandfather')) {
        return {
          ok: true,
          async json() {
            return {
              english: 'grandfather',
              entry: { svg: '<svg id="bank-grandfather"></svg>', hash: 'manual-upload' },
            };
          },
        };
      }
      return orig(url);
    };

    // No local bank provider in this unit test — cache path must still work.
    delete globalThis.MemoryEngineCatalogLocalProvider;

    const first = await SL.resolveIcon('girl');
    assert(first?.svg?.includes('bank-girl'), 'girl from cache');
    assert(first?.hash === 'bank:girl', 'girl gets stable bank hash');

    const second = await SL.resolveIcon('grandfather', {
      excludeHashes: globalThis.MemoryEngineStreamlineSession.getUsedHashes(),
    });
    globalThis.fetch = orig;

    assert(second?.svg?.includes('bank-grandfather'), 'grandfather still from cache');
    assert(second?.source === 'cache', 'grandfather source cache not streamline-new');
    assert(second?.hash === 'bank:grandfather', 'grandfather unique bank hash');
    assert(!searched, 'must not fall through to Streamline search');
    console.log('PASS manual-upload sentinel does not block other bank terms');
  })();
}

async function run() {
  await testCachedSvgSkipsDownload();
  await testHashOnlyMappingDownloadsOnce();
  await testSecondResolveUsesCache();
  await testMappingMiss();
  await testAiSelectsNonFirstHash();
  await testExcludeHashesSkipsAlreadyUsedIcon();
  await testCachedHashExcludedForcesResearch();
  await testManualUploadHashDoesNotBlockOtherBankTerms();
  await testEmptyStateFallbackOnStreamlineMiss();
  await testEmptyStateFallbackMissingReturnsNull();
  await testEmptyStateFallbackReusableAcrossTerms();
  await testRankDoesNotPreferFree();
  await testSelectErrorFallsBack();
  await testResolvePreviewUrl();
  await testLoadCandidateImagesPrefersUrl();
  await testConcurrentBankSavesPersistAll();
  await testEnsureBankedIconsBatchSkipsExisting();
  console.log('\nAll streamline provider tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
