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

async function testVerbToNoun() {
  const Translate = load();
  const mockClient = {
    callClaudeJSON: async () => ({
      translations: [{ hebrew: 'נסענו', english: 'travel' }],
    }),
  };
  const result = await Translate.translateWords(
    [{ hebrew: 'נסענו', english: 'we traveled', category: 'action', hint: 'we traveled' }],
    { client: mockClient }
  );
  assert(result.translations[0].english === 'travel', 'verb→noun');
  assert(result.translations[0].source === 'ai', 'action verbs re-translated via AI');
  console.log('PASS verb to pictogram noun');
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
  await testVerbToNoun();
  await testResolvePictogramWords();
  console.log('\nAll translate-words tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
