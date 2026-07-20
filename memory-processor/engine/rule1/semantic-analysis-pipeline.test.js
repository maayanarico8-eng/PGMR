/**
 * PROCESSOR_SPEC unit tests — assignSequence, validateRule1Output, parseModelJSON.
 * Run: node memory-processor/engine/rule1/semantic-analysis-pipeline.test.js
 */
const path = require('path');
const fs = require('fs');

function load() {
  const g = globalThis;
  g.fetch = async () => { throw new Error('fetch should not be called in unit tests'); };
  ['../anthropic-client.js', 'compound-phrases.js', 'semantic-analysis-pipeline.js'].forEach((f) => {
    eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  });
  return g.MemoryEngineRule1;
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function testAssignSequence(rule1) {
  const cases = [
    { name: 'T1', memory: 'אחרי בית ספר סבא היה מכין לי לארוחת צהריים אורז עם אפונה וגזר במיקרוגל.', words: ['סבא', 'ספר', 'אורז', 'מכין', 'לי'], expected: ['ספר', 'סבא', 'מכין', 'לי', 'אורז'] },
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

  const multiWord = {
    representativeWords: [{ word: 'סבא' }, { word: 'מכין לי' }, { word: 'אורז' }],
    decisionPath: [{ verb: 'מכין', exitStep: 'V3-enters' }],
  };
  assert(
    rule1.validateRule1Output(multiWord, memory).some((e) => e.includes('single token') || e.includes('compound')),
    'multi-word verb phrase must fail'
  );
  console.log('PASS: multi-word verb phrase fails validation');

  const schoolMemory = 'הלכתי לבית ספר עם סבא';
  const compoundOk = {
    representativeWords: [{ word: 'בית ספר' }, { word: 'סבא' }],
    decisionPath: [],
  };
  assert(rule1.validateRule1Output(compoundOk, schoolMemory).length === 0, 'בית ספר allowed');
  console.log('PASS: lexicalized compound בית ספר passes validation');

  const adjNoun = {
    representativeWords: [{ word: 'מכין לי' }, { word: 'סבא' }],
    decisionPath: [{ verb: 'מכין', exitStep: 'V3-enters' }],
  };
  assert(
    rule1.validateRule1Output(adjNoun, 'סבא היה מכין לי אורז').some((e) => e.includes('compound') || e.includes('single token')),
    'verb+recipient must fail structural check'
  );
  console.log('PASS: verb+recipient multi-word fails validation');
}

function testCollapse(rule1) {
  assert(rule1.collapseToSingleToken('7 בבוקר', 'time') === '7', 'clock compound → numeric');
  assert(rule1.isAllowedCompoundPhrase('שיעור ספרדית') === true, 'lesson+subject left to model (not structural forbid)');
  assert(rule1.collapseToSingleToken('שיעור ספרדית', 'object') === 'שיעור ספרדית', 'non-forbidden 2-word kept by code');
  assert(rule1.collapseToSingleToken('מכין לי', 'action') === 'מכין', 'action+לי collapsed');
  assert(rule1.collapseToSingleToken('בית ספר', 'place') === 'בית ספר', 'school compound kept');
  assert(rule1.collapseToSingleToken('בית חולים', 'place') === 'בית חולים', 'hospital compound kept');
  assert(rule1.collapseToSingleToken('מזג אוויר', 'object') === 'מזג אוויר', 'weather compound kept');
  assert(rule1.collapseToSingleToken('אמא ואני', 'person') === 'אמא', 'conjunction collapsed');
  assert(rule1.collapseToSingleToken('היה מצייר', 'action') === 'היה', 'aux+verb collapsed');
  assert(rule1.collapseToSingleToken('קופץ על', 'action') === 'קופץ', 'verb+על collapsed');
  assert(rule1.isForbiddenMultiWordLabel('בית יפה') === false, 'adj+noun left to model prompt');
  const enforced = rule1.enforceSingleTokenWords({
    representativeWords: [
      { word: '7 בבוקר', category: 'time' },
      { word: 'גן ילדים', category: 'place' },
      { word: 'היה מצייר', category: 'action' },
      { word: 'מכין לי', category: 'action' },
    ],
  });
  assert(enforced.representativeWords[0].word === '7', 'enforce clock');
  assert(enforced.representativeWords[1].word === 'גן ילדים', 'enforce keeps kindergarten');
  assert(enforced.representativeWords[2].word === 'היה', 'enforce collapses aux+verb');
  assert(enforced.representativeWords[3].word === 'מכין', 'enforce collapses verb+לי');
  console.log('PASS: collapseToSingleToken + enforceSingleTokenWords');
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
  testCollapse(rule1);
  testParse(globalThis);
  console.log('ALL TESTS PASSED');
}
main();
