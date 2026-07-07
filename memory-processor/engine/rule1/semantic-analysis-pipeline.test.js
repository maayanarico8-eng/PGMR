/**
 * PROCESSOR_SPEC unit tests — assignSequence, validateRule1Output, parseModelJSON.
 * Run: node memory-processor/engine/rule1/semantic-analysis-pipeline.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  g.fetch = async () => { throw new Error('fetch should not be called in unit tests'); };
  ['../anthropic-client.js', 'semantic-analysis-pipeline.js'].forEach((f) => {
    eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  return g.MemoryEngineRule1;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function testAssignSequence(rule1) {
  const cases = [
    { name: 'T1', memory: 'אחרי בית ספר סבא היה מכין לי לארוחת צהריים אורז עם אפונה וגזר במיקרוגל.', words: ['סבא', 'בית ספר', 'אורז', 'מכין', 'לי'], expected: ['בית ספר', 'סבא', 'מכין', 'לי', 'אורז'] },
    { name: 'T2', memory: 'סבא היה לוקח אותי כל שישי לשוק', words: ['סבא', 'אותי', 'שישי', 'שוק', 'לוקח'], expected: ['סבא', 'לוקח', 'אותי', 'שישי', 'שוק'] },
    { name: 'T3', memory: 'הלכנו לספרייה לחפש ספר על דינוזאורים', words: ['ספר', 'ספרייה', 'הלכנו', 'דינוזאורים'], expected: ['הלכנו', 'ספרייה', 'ספר', 'דינוזאורים'] },
    { name: 'T4', memory: 'סבא לקח אותי לשוק וסבא קנה לי בלון', words: ['סבא', 'שוק', 'בלון'], expected: ['סבא', 'שוק', 'בלון'] },
  ];
  cases.forEach(({ name, memory, words, expected }) => {
    const ordered = rule1.assignSequence(words.map((word) => ({ word })), memory).map((r) => r.word);
    assert(ordered.join('|') === expected.join('|'), `${name} FAIL: got [${ordered}] expected [${expected}]`);
    console.log(`PASS ${name}: ${ordered.join(' → ')}`);
  });
}

function testValidation(rule1) {
  const memory = 'סבא היה מכין לי אורז';
  const base = {
    representativeWords: [{ word: 'סבא' }, { word: 'מכין' }, { word: 'לי' }],
    decisionPath: [{ verb: 'מכין', exitStep: 'V3-enters' }],
  };
  assert(rule1.validateRule1Output(base, memory).length === 0, 'valid should pass');
  console.log('PASS T6: valid words pass');

  const invented = { ...base, representativeWords: [...base.representativeWords, { word: 'ממציא' }] };
  assert(rule1.validateRule1Output(invented, memory).some((e) => e.includes('ממציא')), 'invented');
  console.log('PASS T6: invented word fails');

  const missingVerb = {
    representativeWords: [{ word: 'סבא' }, { word: 'לי' }],
    decisionPath: [{ verb: 'מכין', exitStep: 'V3-enters' }],
  };
  assert(
    rule1.validateRule1Output(missingVerb, memory).some((e) => e.includes('V3-enters')),
    'decisionPath'
  );
  console.log('PASS T5: decisionPath V3-enters without matching word fails');

  const twoWords = { representativeWords: [{ word: 'סבא' }, { word: 'מכין' }], decisionPath: [] };
  assert(rule1.validateRule1Output(twoWords, memory).length === 0, 'two words ok');
  console.log('PASS T7: 2 words passes');

  const oneWord = { representativeWords: [{ word: 'סבא' }], decisionPath: [] };
  assert(rule1.validateRule1Output(oneWord, memory).some((e) => e.includes('minimum')), 'min');
  console.log('PASS T7: 1 word fails');

  const tooMany = {
    representativeWords: Array.from({ length: 11 }, (_, i) => ({ word: 'סבא' })),
    decisionPath: [],
  };
  assert(rule1.validateRule1Output(tooMany, memory).some((e) => e.includes('maximum')), 'max');
  console.log('PASS T7: 11 words fails');
}

function testParse(g) {
  const first = { representativeWords: [{ word: 'סבא' }] };
  const second = { representativeWords: [{ word: 'אמא' }] };
  const parsed = g.MemoryEngineAnthropic.parseModelJSON('note\n' + JSON.stringify(first) + JSON.stringify(second));
  assert(parsed.representativeWords[0].word === 'סבא', 'T8');
  console.log('PASS T8: first JSON object from back-to-back');
}

function main() {
  const rule1 = load();
  testAssignSequence(rule1);
  testValidation(rule1);
  testParse(globalThis);
  console.log('ALL TESTS PASSED');
}
main();
