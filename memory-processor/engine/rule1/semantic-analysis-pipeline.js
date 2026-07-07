/**
 * PROCESSOR_SPEC Rule 1 pipeline — guard, API, parse, validate, retry, assignSequence.
 */
(function (root) {
  const PREFIXES = ['וה', 'של', 'ול', 'וב', 'ומ', 'וכ', 'וש', 'שה', 'לה', 'בה', 'מה', 'כש', 'ו', 'ה', 'ל', 'ב', 'מ', 'כ', 'ש'];
  const MIN_WORDS = 3;
  const MAX_WORDS = 10;
  const MAX_MEMORY_WORDS = 20;
  const JSON_SYSTEM = 'You output only valid JSON. No markdown. No code fences. No explanation.';

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function inputGuard(memoryText) {
    const n = wordCount(memoryText);
    if (n > MAX_MEMORY_WORDS) throw new Error('Memory must be at most 20 words.');
    if (!memoryText.trim()) throw new Error('Memory text is empty.');
  }

  function tokenize(text) {
    return text.split(/\s+/).map((t, i) => ({
      raw: t.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, ''),
      idx: i,
    })).filter((t) => t.raw);
  }

  function tokenMatches(textTok, wordTok) {
    if (textTok === wordTok) return true;
    for (const pre of PREFIXES) {
      if (textTok === pre + wordTok) return true;
    }
    return false;
  }

  function firstAnchor(memoryTokens, word) {
    const wToks = word.trim().split(/\s+/);
    for (let i = 0; i <= memoryTokens.length - wToks.length; i++) {
      let ok = true;
      for (let j = 0; j < wToks.length; j++) {
        if (!tokenMatches(memoryTokens[i + j].raw, wToks[j])) { ok = false; break; }
      }
      if (ok) return memoryTokens[i].idx;
    }
    return -1;
  }

  function assignSequence(rws, memoryText) {
    const toks = tokenize(memoryText);
    const anchored = (rws || []).map((r) => ({ ...r, _anchor: firstAnchor(toks, r.word || '') }));
    anchored.sort((a, b) => (a._anchor !== b._anchor ? a._anchor - b._anchor : (b.word || '').length - (a.word || '').length));
    anchored.forEach((r, i) => {
      r.sequencePosition = i + 1;
      r.narrativePosition = i + 1;
      delete r._anchor;
    });
    return anchored;
  }

  function validateRule1Output(parsed, memoryText) {
    const errors = [];
    if (!parsed || typeof parsed !== 'object') {
      errors.push('parsed output is not an object');
      return errors;
    }
    if (!parsed.memoryLanguage) errors.push('missing memoryLanguage');
    const rws = parsed.representativeWords;
    if (!Array.isArray(rws)) {
      errors.push('missing representativeWords array');
      return errors;
    }
    rws.forEach((r) => {
      const w = (r.word || '').trim();
      if (w && !memoryText.includes(w)) errors.push(`word "${w}" does not appear in the written memory`);
    });
    if (rws.length < MIN_WORDS) errors.push(`only ${rws.length} representative words — minimum is ${MIN_WORDS}`);
    if (rws.length > MAX_WORDS) errors.push(`${rws.length} representative words — maximum is ${MAX_WORDS}`);
    if (parsed.validationStatus === 'fail' && parsed.validationNote) {
      errors.push(`model validationStatus fail: ${parsed.validationNote}`);
    }
    return errors;
  }

  function normalizeConsiderationForUi(record) {
    if (!Array.isArray(record)) return [];
    return record.map((c) => {
      const isConstituent =
        c.finalClassification === 'constituent' ||
        c.finalClassification === 'constituent-conservative-default' ||
        c.gateOutcome === 'direct-automatic' ||
        c.gateOutcome === 'constituent' ||
        c.gateOutcome === 'constituent-conservative-default';
      return {
        ...c,
        identityGate: c.identityGate || (c.gateOutcome === 'direct-automatic' || isConstituent ? 'changes-identity' : 'reduces-detail'),
        identityGateReason: c.identityGateReason || c.gateReason || c.rationale || '',
        decision: c.decision || (isConstituent ? 'representative' : 'semantic-only'),
        criterion1: c.criterion1 || 'not-evaluated',
        criterion2: c.criterion2 || 'not-evaluated',
        criterion3: c.criterion3 || 'not-evaluated',
        criterion4: c.criterion4 || 'not-evaluated',
        decisionReason: c.decisionReason || c.rationale || c.gateReason || '',
      };
    });
  }

  function finalizeRule1(parsed, memoryText) {
    const result = { ...parsed };
    result.representativeWords = assignSequence(result.representativeWords || [], memoryText);
    result.considerationRecord = normalizeConsiderationForUi(result.considerationRecord);
    if (result.memoryFrame && result.memoryFrame.temporalContext == null && result.temporalContext) {
      result.memoryFrame.temporalContext = result.temporalContext;
    }
    result._engine = { source: 'processor-spec-r1', stages: '1.1-1.7' };
    return result;
  }

  async function callRule1Anthropic(memoryText, promptR1, extraUserSuffix) {
    const anthropic = root.MemoryEngineAnthropic;
    if (!anthropic?.callClaude) throw new Error('MemoryEngineAnthropic.callClaude is not loaded');
    const userContent = promptR1 + '\n\nWritten memory:\n\n' + memoryText + (extraUserSuffix || '');
    const raw = await anthropic.callClaude({
      max_tokens: 4000,
      system: JSON_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });
    return anthropic.parseModelJSON(raw);
  }

  async function runSemanticAnalysisPipeline(memoryText, options) {
    const promptR1 = options?.promptR1 || root.MemoryEngineRule1?.PROMPT_R1;
    if (!promptR1) throw new Error('PROMPT_R1 is not loaded');
    inputGuard(memoryText);
    let parsed = await callRule1Anthropic(memoryText, promptR1);
    let errors = validateRule1Output(parsed, memoryText);
    if (errors.length) {
      const retrySuffix =
        '\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION with these errors:\n' +
        errors.map((e) => '- ' + e).join('\n') +
        '\n\nPrevious output was:\n' + JSON.stringify(parsed) +
        '\n\nFix ALL the errors and return the corrected JSON per the output schema.';
      parsed = await callRule1Anthropic(memoryText, promptR1, retrySuffix);
      errors = validateRule1Output(parsed, memoryText);
      if (errors.length) {
        throw new Error('Rule 1 validation failed:\n' + errors.map((e) => '- ' + e).join('\n'));
      }
    }
    return finalizeRule1(parsed, memoryText);
  }

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.runSemanticAnalysisPipeline = runSemanticAnalysisPipeline;
  root.MemoryEngineRule1.assignSequence = assignSequence;
  root.MemoryEngineRule1.validateRule1Output = validateRule1Output;
  root.MemoryEngineRule1.inputGuard = inputGuard;
  root.MemoryEngineRule1.RULE1_LIMITS = { MIN_WORDS, MAX_WORDS, MAX_MEMORY_WORDS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
