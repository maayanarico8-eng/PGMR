/**
 * PROCESSOR_SPEC Rule 1 pipeline — guard, API, parse, validate, retry, assignSequence.
 */
(function (root) {
  const PREFIXES = ['וה', 'של', 'ול', 'וב', 'ומ', 'וכ', 'וש', 'שה', 'לה', 'בה', 'מה', 'כש', 'ו', 'ה', 'ל', 'ב', 'מ', 'כ', 'ש'];
  const MIN_WORDS = 2;
  const MAX_WORDS = 10;
  const MAX_MEMORY_WORDS = 20;
  const JSON_SYSTEM = 'You output only valid JSON. No markdown. No code fences. No explanation.';
  const ENTER_EXITS = ['V3-enters', 'V4-creation-enters', 'V4-modification-enters'];

  function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /** Collapse multi-word RW labels to one token (UI must never show spaced labels). */
  function collapseToSingleToken(word, category) {
    const parts = (word || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return (word || '').trim();
    const numeric = parts.find((p) => /\d/.test(p));
    if (numeric) return numeric;
    const cat = (category || '').toLowerCase();
    if (cat === 'action' || cat === 'participant') return parts[0];
    return parts[parts.length - 1];
  }

  function hasWhitespace(word) {
    return /\s/.test((word || '').trim());
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
    const rws = parsed.representativeWords;
    if (!Array.isArray(rws)) {
      errors.push('missing representativeWords array');
      return errors;
    }
    const dp = parsed.decisionPath || [];
    dp.forEach((d) => {
      if (ENTER_EXITS.includes(d.exitStep)) {
        const verb = d.verb || '';
        const found = rws.some(
          (r) => r.word === verb || (r.word && verb && (r.word.includes(verb) || verb.includes(r.word)))
        );
        if (!found) {
          errors.push(`verb "${verb}" exited ${d.exitStep} but is missing from representativeWords`);
        }
      }
    });
    rws.forEach((r) => {
      const w = (r.word || '').trim();
      if (w && hasWhitespace(w)) {
        errors.push(`word "${w}" must be a single token with no spaces`);
      }
      if (w && !memoryText.includes(w)) errors.push(`word "${w}" does not appear in the written memory`);
    });
    if (rws.length < MIN_WORDS) errors.push(`only ${rws.length} representative words — minimum is ${MIN_WORDS}`);
    if (rws.length > MAX_WORDS) errors.push(`${rws.length} representative words — maximum is ${MAX_WORDS}`);
    if (parsed.validationStatus === 'fail' && parsed.validationNote) {
      errors.push(`model validationStatus fail: ${parsed.validationNote}`);
    }
    return errors;
  }

  function isLeanSchema(parsed) {
    return Array.isArray(parsed.representativeWords) && !parsed.memoryLanguage;
  }

  function enforceSingleTokenWords(parsed) {
    if (!parsed || !Array.isArray(parsed.representativeWords)) return parsed;
    parsed.representativeWords = parsed.representativeWords.map((rw) => {
      const original = (rw.word || '').trim();
      const word = collapseToSingleToken(original, rw.category);
      if (!word || word === original) return { ...rw, word: word || original };
      return {
        ...rw,
        word,
        sourceText: rw.sourceText || original,
      };
    });
    return parsed;
  }

  function finalizeRule1(parsed, memoryText) {
    enforceSingleTokenWords(parsed);
    if (isLeanSchema(parsed)) {
      const sequenced = assignSequence(parsed.representativeWords || [], memoryText);
      const build = root.MemoryEngineRule1.buildRule1FromWords;
      if (!build) throw new Error('buildRule1FromWords is not loaded');
      const result = build(
        memoryText,
        { representativeWords: sequenced, temporalContext: parsed.temporalContext },
        null
      );
      result.representativeWords = sequenced.map((rw, i) => ({
        ...result.representativeWords[i],
        ...rw,
        id: result.representativeWords[i]?.id || `rw_${String(i + 1).padStart(2, '0')}`,
        sourceText: rw.sourceText || rw.word,
        narrativePosition: rw.sequencePosition,
      }));
      if (parsed.temporalContext) {
        result.memoryFrame = result.memoryFrame || {};
        result.memoryFrame.temporalContext = parsed.temporalContext;
      }
      result._engine = {
        source: 'processor-spec-r1',
        stages: 'decision-tree',
        model: root.MemoryEngineAnthropic?.MODEL || 'claude-sonnet-5',
        decisionPath: parsed.decisionPath || [],
      };
      result.validationStatus = parsed.validationStatus;
      result.validationNote = parsed.validationNote;
      return result;
    }

    const result = { ...parsed };
    result.representativeWords = assignSequence(result.representativeWords || [], memoryText);
    if (result.memoryFrame && result.memoryFrame.temporalContext == null && result.temporalContext) {
      result.memoryFrame.temporalContext = result.temporalContext;
    }
    result._engine = {
      source: 'processor-spec-r1',
      stages: 'full-schema',
      model: root.MemoryEngineAnthropic?.MODEL || 'claude-sonnet-5',
    };
    return result;
  }

  async function callRule1Anthropic(memoryText, promptR1, extraUserSuffix) {
    const anthropic = root.MemoryEngineAnthropic;
    if (!anthropic?.callClaude) throw new Error('MemoryEngineAnthropic.callClaude is not loaded');
    const userContent = promptR1 + '\n\nWritten memory:\n\n' + memoryText + (extraUserSuffix || '');
    const raw = await anthropic.callClaude({
      model: anthropic.MODEL || 'claude-sonnet-5',
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system: JSON_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    });
    return anthropic.parseModelJSON(raw);
  }

  async function runSemanticAnalysisPipeline(memoryText, options) {
    const promptR1 = options?.promptR1 || root.MemoryEngineRule1?.PROMPT_R1;
    if (!promptR1) throw new Error('PROMPT_R1 is not loaded');
    inputGuard(memoryText);
    let parsed = enforceSingleTokenWords(await callRule1Anthropic(memoryText, promptR1));
    let errors = validateRule1Output(parsed, memoryText);
    if (errors.length) {
      const retrySuffix =
        '\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION with these errors:\n' +
        errors.map((e) => '- ' + e).join('\n') +
        '\n\nPrevious output was:\n' +
        JSON.stringify(parsed) +
        '\n\nFix ALL the errors and return the corrected JSON. Remember the FINAL ASSEMBLY RULE. Every representativeWords.word must be a single token with NO spaces.';
      parsed = enforceSingleTokenWords(await callRule1Anthropic(memoryText, promptR1, retrySuffix));
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
  root.MemoryEngineRule1.collapseToSingleToken = collapseToSingleToken;
  root.MemoryEngineRule1.enforceSingleTokenWords = enforceSingleTokenWords;
  root.MemoryEngineRule1.inputGuard = inputGuard;
  root.MemoryEngineRule1.RULE1_LIMITS = { MIN_WORDS, MAX_WORDS, MAX_MEMORY_WORDS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
