/**
 * Golden tests for Rule 1 local engine (run: node memory-processor/engine/rule1/test.js)
 */
const path = require('path');
const fs = require('fs');

function loadEngine() {
  const g = globalThis;
  const files = [
    '../config.js',
    'extract-event-model.js',
    'stages.js',
    'index.js',
  ].map((f) => path.join(__dirname, f));
  files.forEach((file) => {
    // eslint-disable-next-line no-eval
    eval(fs.readFileSync(file, 'utf8'));
  });
  return g.MemoryEngineRule1;
}

const MOCK_MEMORY = 'בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד.';

function main() {
  const rule1 = loadEngine();
  const out = rule1.runRule1(MOCK_MEMORY);
  if (!out.supported) {
    console.error('FAIL: extractor did not support mock memory');
    process.exit(1);
  }
  const r = out.result;
  const rwWords = (r.representativeWords || []).map((w) => w.word);
  const expected = ['סבא', 'מספר/ת', 'קריאת עיתון', 'עיתון', 'שירה ביחד'];
  const missing = expected.filter((w) => !rwWords.includes(w));
  const extra = rwWords.filter((w) => !expected.includes(w));

  console.log('Extractor:', out.extractor);
  console.log('Representative words:', rwWords.join(', '));
  console.log('Consistency gate:', r.consistencyGateStatus);

  if (missing.length) {
    console.error('FAIL: missing RW:', missing.join(', '));
    process.exit(1);
  }
  if (rwWords.includes('שבת בבוקר')) {
    console.error('FAIL: temporal referent should not be in representativeWords');
    process.exit(1);
  }
  if (r.consistencyGateStatus !== 'pass') {
    console.error('FAIL: consistency gate should pass');
    process.exit(1);
  }
  console.log('PASS: Rule 1 golden test');
  if (extra.length) console.log('Note: extra RW:', extra.join(', '));
}

main();
