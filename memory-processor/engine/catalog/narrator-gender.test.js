/**
 * narrator-gender unit tests
 * Run: node memory-processor/engine/catalog/narrator-gender.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  eval(fs.readFileSync(path.join(__dirname, 'narrator-gender.js'), 'utf8'));
  return g.MemoryEngineNarratorGender;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testDetection() {
  const NG = load();
  assert(NG.isNarratorSelfWord('לי', 'narrator'), 'לי');
  assert(NG.isNarratorSelfWord('אני', null), 'אני');
  assert(NG.isNarratorSelfWord('אותי', 'me'), 'אותי');
  assert(NG.isNarratorSelfWord('me', 'me'), 'me');
  assert(NG.isNarratorSelfWord('I', 'i'), 'I');
  assert(!NG.isNarratorSelfWord('מכין לי', 'cooking for me'), 'phrase not self');
  assert(!NG.isNarratorSelfWord('סבא', 'grandfather'), 'not narrator');
  console.log('PASS narrator self-word detection');
}

function testGenderTerms() {
  const NG = load();
  assert(NG.pictogramTermForGender('male') === 'man', 'male → man');
  assert(NG.pictogramTermForGender('female') === 'woman', 'female → woman');
  assert(NG.pictogramTermForGender('נקבה') === 'woman', 'נקבה → woman');
  assert(NG.resolveEnglishForPictogram('לי', 'narrator', 'male') === 'man', 'לי male');
  assert(NG.resolveEnglishForPictogram('לי', 'narrator', 'female') === 'woman', 'לי female');
  assert(NG.resolveEnglishForPictogram('סבא', 'grandfather', 'male') === 'grandfather', 'non-narrator unchanged');
  console.log('PASS gender pictogram terms');
}

async function testTranslateIntegration() {
  const g = globalThis;
  g.fetch = async () => { throw new Error('fetch should not be called'); };
  ['../logger.js', '../anthropic-client.js', 'narrator-gender.js', 'translate-words.js'].forEach((f) => {
    eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  const Translate = g.MemoryEngineCatalogTranslate;
  const result = await Translate.translateWords(
    [{ hebrew: 'לי', english: 'narrator', category: 'participant' }],
    {
      narratorGender: 'female',
      client: { callClaudeJSON: async () => { throw new Error('should not call AI'); } },
    }
  );
  assert(result.translations[0].english === 'woman', 'לי → woman');
  assert(result.translations[0].narratorRedirect === true, 'redirect flagged');
  console.log('PASS translate integration for narrator gender');
}

async function run() {
  testDetection();
  testGenderTerms();
  await testTranslateIntegration();
  console.log('\nAll narrator-gender tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
