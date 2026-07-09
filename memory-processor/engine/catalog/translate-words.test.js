/**
 * translate-words unit tests
 * Run: node memory-processor/engine/catalog/translate-words.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  g.fetch = async () => { throw new Error('fetch should not be called in unit tests'); };
  ['../logger.js', '../anthropic-client.js', 'translate-words.js'].forEach((f) => {
    eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  return g.MemoryEngineCatalogTranslate;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testPassThrough() {
  const Translate = load();
  const result = await Translate.translateWords(
    [
      { hebrew: 'סבא', english: 'Grandfather' },
      { hebrew: 'עיתון', english: 'newspaper' },
    ],
    { client: { callClaudeJSON: async () => { throw new Error('should not call AI'); } } }
  );
  assert(result.translations.length === 2, 'expected 2 translations');
  assert(result.translations[0].english === 'grandfather', 'normalized lowercase');
  assert(result.translations[0].source === 'semantic-analysis', 'semantic source');
  assert(result.translations[1].source === 'semantic-analysis', 'semantic source 2');
  console.log('PASS pass-through with canonicalReferent');
}

async function testBatchAi() {
  const Translate = load();
  const mockClient = {
    callClaudeJSON: async () => ({
      translations: [
        { hebrew: 'חתול', english: 'Cat' },
        { hebrew: 'פארק', english: 'Park' },
      ],
    }),
  };
  const result = await Translate.translateWords(
    [{ hebrew: 'חתול' }, { hebrew: 'פארק' }],
    { client: mockClient }
  );
  assert(result.translations.length === 2, 'expected 2 ai translations');
  assert(result.translations[0].english === 'cat', 'ai normalized');
  assert(result.translations[0].source === 'ai', 'ai source');
  assert(result.translations[1].english === 'park', 'ai normalized 2');
  console.log('PASS batch AI translation');
}

async function testMixed() {
  const Translate = load();
  const mockClient = {
    callClaudeJSON: async () => ({
      translations: [{ hebrew: 'כלב', english: 'Dog' }],
    }),
  };
  const result = await Translate.translateWords(
    [
      { hebrew: 'סבא', english: 'grandfather' },
      { hebrew: 'כלב' },
    ],
    { client: mockClient }
  );
  assert(result.translations[0].source === 'semantic-analysis', 'first from semantic');
  assert(result.translations[1].source === 'ai', 'second from ai');
  assert(result.translations[1].english === 'dog', 'ai word');
  console.log('PASS mixed semantic + AI');
}

async function testLogger() {
  const Translate = load();
  const events = [];
  const logger = {
    log(stage, type, data) {
      events.push({ stage, type, data });
    },
  };
  await Translate.translateWords([{ hebrew: 'סבא', english: 'grandfather' }], {
    logger,
    client: { callClaudeJSON: async () => ({ translations: [] }) },
  });
  assert(events.some((e) => e.type === 'TRANSLATE_START'), 'TRANSLATE_START logged');
  assert(events.some((e) => e.type === 'TRANSLATE_DONE'), 'TRANSLATE_DONE logged');
  console.log('PASS logger events');
}

async function testContextAwareDrive() {
  const Translate = load();
  const memoryText = 'נסענו לטיול ביער.';
  const mockClient = {
    callClaudeJSON: async (body) => {
      const content = body.messages[0].content;
      assert(content.includes(memoryText), 'memory sent to AI');
      return { translations: [{ hebrew: 'נסענו', english: 'drive' }] };
    },
  };
  const result = await Translate.translateWords(
    [{
      hebrew: 'נסענו',
      english: 'travel',
      category: 'action',
      hint: 'travel',
      sourceText: 'נסענו',
    }],
    { client: mockClient, memoryText }
  );
  assert(result.translations[0].english === 'drive', 'context-aware drive');
  assert(result.translations[0].source === 'ai', 'action verbs re-translated via AI');
  console.log('PASS context-aware drive for נסענו');
}

async function testContextDisambiguationPool() {
  const Translate = load();
  const memoryText = 'בקיץ סבא היה לוקח אותי לבריכה וקונה לי גלידה';
  const mockClient = {
    callClaudeJSON: async () => ({
      translations: [{ hebrew: 'בריכה', english: 'swimming pool' }],
    }),
  };
  const result = await Translate.translateWords(
    [{
      hebrew: 'בריכה',
      english: 'pool',
      category: 'location',
      hint: 'pool',
      sourceText: 'לבריכה',
    }],
    { client: mockClient, memoryText }
  );
  assert(result.translations[0].english === 'swimming pool', 'pool disambiguated');
  assert(result.translations[0].source === 'ai', 'context routes object through AI');
  console.log('PASS context disambiguation for בריכה');
}

async function testMemoryContextRoutesAllWordsThroughAi() {
  const Translate = load();
  let aiCalled = false;
  const mockClient = {
    callClaudeJSON: async () => {
      aiCalled = true;
      return { translations: [{ hebrew: 'בריכה', english: 'swimming pool' }] };
    },
  };
  await Translate.translateWords(
    [{ hebrew: 'בריכה', english: 'pool', category: 'object', hint: 'pool' }],
    {
      client: mockClient,
      memoryText: 'בקיץ סבא היה לוקח אותי לבריכה וקונה לי גלידה',
    }
  );
  assert(aiCalled, 'AI called even for non-action with pre-filled english when memory present');
  console.log('PASS memory context routes all words through AI');
}

async function testNoMemoryFallback() {
  const Translate = load();
  const mockClient = {
    callClaudeJSON: async () => { throw new Error('should not call AI'); },
  };
  const result = await Translate.translateWords(
    [{ hebrew: 'בריכה', english: 'pool', category: 'object', hint: 'pool' }],
    { client: mockClient }
  );
  assert(result.translations[0].english === 'pool', 'pass-through without memory');
  assert(result.translations[0].source === 'semantic-analysis', 'semantic source without memory');
  console.log('PASS no-memory fallback preserves pass-through');
}

async function testBuildCanonicalMapIncludesSourceText() {
  const Translate = load();
  const map = Translate.buildCanonicalMapFromRule1({
    representativeWords: [
      {
        word: 'בריכה',
        canonicalReferent: 'pool',
        category: 'location',
        sourceText: 'לבריכה',
      },
    ],
  });
  assert(map['בריכה'].sourceText === 'לבריכה', 'sourceText in canonical map');
  assert(map['בריכה'].category === 'location', 'category in canonical map');
  console.log('PASS buildCanonicalMapFromRule1 includes sourceText');
}

async function testResolvePictogramWords() {
  const Translate = load();
  const mockClient = {
    callClaudeJSON: async () => ({
      translations: [{ hebrew: 'חתול', english: 'cat' }],
    }),
  };
  const mockResolve = async (hebrew, opts) => ({
    hebrew,
    english: opts.english || null,
    status: 'hit',
    svg: '<svg></svg>',
    source: 'mapping',
    catalogId: hebrew === 'סבא' ? 'CAT-0001' : null,
    assetRef: `${hebrew}.svg`,
    entry: null,
  });
  const result = await Translate.resolvePictogramWords(['סבא', 'חתול'], {
    client: mockClient,
    canonicalMap: { סבא: 'grandfather' },
    resolve: mockResolve,
  });
  assert(result.translations.length === 2, 'translations count');
  assert(result.slots[0].hebrew === 'סבא', 'slot hebrew');
  assert(result.slots[0].english === 'grandfather', 'slot english from semantic');
  assert(result.slots[0].status === 'hit', 'סבא hit');
  assert(result.slots[1].hebrew === 'חתול', 'slot2 hebrew');
  assert(result.slots[1].english === 'cat', 'slot2 english from ai');
  console.log('PASS resolvePictogramWords returns hebrew + english slots');
}

async function run() {
  await testPassThrough();
  await testBatchAi();
  await testMixed();
  await testLogger();
  await testContextAwareDrive();
  await testContextDisambiguationPool();
  await testMemoryContextRoutesAllWordsThroughAi();
  await testNoMemoryFallback();
  await testBuildCanonicalMapIncludesSourceText();
  await testResolvePictogramWords();
  console.log('\nAll translate-words tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
