/**
 * Test: build Rule 1 from minimal AI word payload.
 * Run: node memory-processor/engine/rule1/build-from-words.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  ['../config.js', '../logger.js', 'extract-event-model.js', 'compound-phrases.js', 'rw-extract-prompt.js', 'build-from-words.js'].forEach((f) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  return g.MemoryEngineRule1;
}

const MEMORY =
  'אחרי הבית ספר, סבא היה מכין לי בצהריים אורז עם אפונה וגזר במיקרוגל';

const AI_PAYLOAD = {
  words: [
    { word: 'סבא', sourceText: 'סבא', category: 'person', canonicalReferent: 'grandfather' },
    { word: 'מכין לי', sourceText: 'מכין לי', category: 'action', canonicalReferent: 'cooking for me' },
    { word: 'אורז', sourceText: 'אורז', category: 'object', canonicalReferent: 'rice' },
    { word: 'אפונה', sourceText: 'אפונה', category: 'object', canonicalReferent: 'peas' },
    { word: 'גזר', sourceText: 'גזר', category: 'object', canonicalReferent: 'carrot' },
    { word: 'מיקרוגל', sourceText: 'מיקרוגל', category: 'object', canonicalReferent: 'microwave' },
  ],
};

function main() {
  const rule1 = load();
  const result = rule1.buildRule1FromWords(MEMORY, AI_PAYLOAD);
  const words = result.representativeWords.map((w) => w.word);
  console.log('Words:', words.join(' → '));
  if (words.length !== 6) {
    console.error('FAIL: expected 6 words');
    process.exit(1);
  }
  if (words[1] !== 'מכין') {
    console.error('FAIL: multi-word action must collapse to single token מכין, got', words[1]);
    process.exit(1);
  }
  if (result._engine?.stages !== 'ai-words') {
    console.error('FAIL: expected ai-words engine marker');
    process.exit(1);
  }
  console.log('PASS: build-from-words');

  const sisterMemory = 'אחותי ואני היינו הולכות עם סבא לקניון לקנות גומי';
  const sisterPayload = {
    words: [
      { word: 'אחותי', sourceText: 'אחותי', category: 'person', canonicalReferent: 'girl' },
      { word: 'היינו', sourceText: 'היינו', category: 'person', canonicalReferent: 'narrator' },
      { word: 'הולכות', sourceText: 'הולכות', category: 'action', canonicalReferent: 'walk' },
      { word: 'סבא', sourceText: 'סבא', category: 'person', canonicalReferent: 'grandfather' },
      { word: 'קניון', sourceText: 'קניון', category: 'place', canonicalReferent: 'mall' },
      { word: 'גומי', sourceText: 'גומי', category: 'object', canonicalReferent: 'candy' },
    ],
  };
  const sister = rule1.buildRule1FromWords(sisterMemory, sisterPayload);
  const sisterWords = sister.representativeWords.map((w) => w.word);
  if (!sisterWords.includes('אני')) {
    console.error('FAIL: expected אני as RW participant, got', sisterWords.join(','));
    process.exit(1);
  }
  if (sisterWords.includes('היינו')) {
    console.error('FAIL: היינו should be replaced by אני, got', sisterWords.join(','));
    process.exit(1);
  }
  console.log('PASS: prefer אני over היינו');

  const omitted = rule1.buildRule1FromWords(sisterMemory, {
    words: sisterPayload.words.filter((w) => w.word !== 'היינו'),
  });
  const omittedWords = omitted.representativeWords.map((w) => w.word);
  if (!omittedWords.includes('אני')) {
    console.error('FAIL: אני must be injected when omitted, got', omittedWords.join(','));
    process.exit(1);
  }
  console.log('PASS: inject אני when omitted');

  const school = rule1.buildRule1FromWords('הלכתי לבית ספר עם סבא', {
    words: [
      { word: 'בית ספר', sourceText: 'בית ספר', category: 'place', canonicalReferent: 'school' },
      { word: 'סבא', sourceText: 'סבא', category: 'person', canonicalReferent: 'grandfather' },
    ],
  });
  if (school.representativeWords[0].word !== 'בית ספר') {
    console.error('FAIL: בית ספר must stay as compound, got', school.representativeWords[0].word);
    process.exit(1);
  }
  console.log('PASS: keep lexicalized compound בית ספר');
}

main();
