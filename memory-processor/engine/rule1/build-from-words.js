/**
 * Build minimal Rule 1 result from AI word extraction (2–10 words).
 * Rule 2+3 consume representativeWords locally — no further AI.
 */
(function (root) {
  const MIN_WORDS = 2;
  const MAX_WORDS = 10;

  function id(prefix, n) {
    return `${prefix}_${String(n).padStart(2, '0')}`;
  }

  function detectLanguage(text) {
    if (root.MemoryEngineRule1.detectLanguage) {
      return root.MemoryEngineRule1.detectLanguage(text);
    }
    const he = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const en = (text.match(/[a-zA-Z]/g) || []).length;
    if (he && en) return 'Mixed';
    if (he) return 'Hebrew';
    return 'English';
  }

  function collapseToSingleToken(word, category) {
    if (root.MemoryEngineRule1?.collapseToSingleToken) {
      return root.MemoryEngineRule1.collapseToSingleToken(word, category);
    }
    const parts = (word || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return (word || '').trim();
    const numeric = parts.find((p) => /\d/.test(p));
    if (numeric) return numeric;
    const cat = (category || '').toLowerCase();
    if (cat === 'action' || cat === 'participant' || cat === 'person') return parts[0];
    return parts[parts.length - 1];
  }

  /** Explicit narrator-as-participant pronouns preferred over conjugated self-forms. */
  const NARRATOR_PARTICIPANT_TOKENS = ['אני', 'לי', 'אותי', 'אלי'];
  const NARRATOR_VERB_FORMS = new Set(['היינו', 'הייתי', 'היית']);

  function memoryTokens(memoryText) {
    const raw = (memoryText || '')
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/^[^\u0590-\u05FFa-zA-Z0-9]+|[^\u0590-\u05FFa-zA-Z0-9]+$/g, ''))
      .filter(Boolean);
    const tokens = new Set(raw);
    // Hebrew conjunctive vav: ואני → also index אני
    raw.forEach((t) => {
      if (t.startsWith('ו') && t.length > 1) tokens.add(t.slice(1));
    });
    return tokens;
  }

  /**
   * Prefer אני/לי/… over היינו/הייתי when the pronoun appears in the memory.
   * Also inject אני when it appears as a participant token but was omitted.
   */
  function preferNarratorParticipantTokens(words, memoryText) {
    const tokens = memoryTokens(memoryText);
    const preferred = NARRATOR_PARTICIPANT_TOKENS.find((t) => tokens.has(t));
    if (!preferred) return words;

    let next = words;
    const hasPreferred = next.some((w) => w.word === preferred);
    if (!hasPreferred) {
      const verbIdx = next.findIndex((w) => NARRATOR_VERB_FORMS.has(w.word));
      if (verbIdx >= 0) {
        next = next.slice();
        next[verbIdx] = {
          ...next[verbIdx],
          word: preferred,
          sourceText: preferred,
          category: 'person',
          canonicalReferent: 'narrator',
        };
      } else if (preferred === 'אני') {
        // Explicit אני participant omitted — inject after the first person word.
        const personIdx = next.findIndex((w) => {
          const c = (w.category || '').toLowerCase();
          return c === 'person' || c === 'participant';
        });
        const insertAt = personIdx >= 0 ? personIdx + 1 : 0;
        next = next.slice();
        next.splice(insertAt, 0, {
          word: 'אני',
          sourceText: 'אני',
          category: 'person',
          canonicalReferent: 'narrator',
        });
        if (next.length > MAX_WORDS) next.splice(MAX_WORDS);
      }
    }
    return next;
  }

  function normalizeAiWordsPayload(aiResponse) {
    if (!aiResponse) return [];
    const list = aiResponse.words || aiResponse.representativeWords || aiResponse;
    if (!Array.isArray(list)) return [];
    return list
      .map((item) => {
        if (typeof item === 'string') {
          const word = collapseToSingleToken(item, 'object');
          return { word, sourceText: item, category: 'object', canonicalReferent: word.toLowerCase() };
        }
        const original = (item.word || item.field || '').trim();
        const category = item.category || 'object';
        const word = collapseToSingleToken(original, category);
        return {
          word,
          sourceText: (item.sourceText || original).trim(),
          category,
          canonicalReferent: (item.canonicalReferent || word || '').toLowerCase().trim(),
        };
      })
      .filter((w) => w.word);
  }

  function buildRule1FromWords(memoryText, aiResponse, logger) {
    const STAGES = root.MemoryEngineLogger?.STAGES || { REPRESENTATIVE: '1.6' };
    let words = preferNarratorParticipantTokens(normalizeAiWordsPayload(aiResponse), memoryText);

    if (logger) {
      logger.log('1.2', 'AI_WORDS_RECEIVED', { count: words.length }, 'Workflow_Grammar:1.6');
    }

    if (words.length < MIN_WORDS) {
      throw new Error(`AI returned ${words.length} words; need ${MIN_WORDS}–${MAX_WORDS}.`);
    }
    if (words.length > MAX_WORDS) {
      words.splice(MAX_WORDS);
    }

    const representativeWords = words.map((w, i) => {
      const rw = {
        id: id('rw', i + 1),
        word: w.word,
        canonicalReferent: w.canonicalReferent || w.word,
        category: w.category,
        sourceText: w.sourceText || w.word,
        narrativePosition: i + 1,
      };
      if (logger) {
        logger.log(STAGES.REPRESENTATIVE, 'RW_INCLUDED', {
          word: rw.word,
          category: rw.category,
          sourceText: rw.sourceText,
          reason: 'Selected by AI word extraction',
        }, 'Semantic_Methodology:P1');
      }
      return rw;
    });

    const considerationRecord = representativeWords.map((rw, i) => ({
      fieldId: id('sf', i + 1),
      field: rw.word,
      canonicalReferent: rw.canonicalReferent,
      category: rw.category,
      identityGate: 'reduces-detail',
      identityGateReason: 'AI word extraction — identity gate deferred to human review.',
      decision: 'representative',
      criterion1: 'satisfied',
      criterion1Reason: 'AI selection from source text',
      criterion2: 'satisfied',
      criterion2Reason: '',
      criterion3: 'not-evaluated',
      criterion3Reason: '',
      criterion4: 'not-evaluated',
      criterion4Reason: '',
      decisionReason: 'Representative word from minimal AI extraction.',
    }));

    const semanticFields = considerationRecord.map((cr) => ({
      id: cr.fieldId,
      field: cr.field,
      canonicalReferent: cr.canonicalReferent,
      category: cr.category,
      sourceText: representativeWords.find((r) => r.word === cr.field)?.sourceText || cr.field,
      description: 'AI-extracted semantic field',
    }));

    return {
      memoryLanguage: detectLanguage(memoryText),
      coreNarrative: memoryText.trim().slice(0, 200),
      memoryFrame: {
        location: null,
        temporalContext: aiResponse.temporalContext || 'singular',
        recurrencePattern: null,
        period: null,
      },
      events: [],
      semanticFields,
      semanticStructure: {
        summary: memoryText.trim().slice(0, 200),
        mustPreserve: ['מבנה המילים המייצגות מ-AI'],
      },
      considerationRecord,
      representativeWords,
      mustPreserveCompliance: [
        {
          requirement: 'מבנה המילים המייצגות מ-AI',
          satisfied: representativeWords.length >= MIN_WORDS,
          satisfiedBy: representativeWords.map((r) => r.id),
          violation: null,
        },
      ],
      consistencyGateStatus: 'pass',
      consistencyGateNote: 'Minimal AI extraction — full Rule 1 stages skipped; Rule 2+3 local.',
      _engine: { stages: 'ai-words', source: 'anthropic-minimal' },
    };
  }

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.buildRule1FromWords = buildRule1FromWords;
  root.MemoryEngineRule1.normalizeAiWordsPayload = normalizeAiWordsPayload;
  root.MemoryEngineRule1.preferNarratorParticipantTokens = preferNarratorParticipantTokens;
  root.MemoryEngineRule1.RW_WORD_LIMITS = { MIN_WORDS, MAX_WORDS };
})(typeof globalThis !== 'undefined' ? globalThis : window);
