/**
 * Test: build Rule 1 from minimal AI word payload.
 * Run: node memory-processor/engine/rule1/build-from-words.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  ['../config.js', '../logger.js', 'extract-event-model.js', 'rw-extract-prompt.js', 'build-from-words.js'].forEach((f) => {
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
}

main();
