/**
 * Hebrew → English translation for pictogram search terms.
 * Uses Rule 1 canonicalReferent as hints; context-aware AI translation when memory text is available.
 */
(function (root) {
  const STAGE = '3.0';

  const TRANSLATE_PROMPT = `You choose English pictogram search terms for a pictogram icon library — NOT general dictionary translations.

INPUT: JSON with optional "memory" (full memory sentence) and "words" array. Each word has hebrew, optional hint (prior guess), sourceText (fragment from memory), and category.
OUTPUT: Valid JSON only. No markdown. No explanation.
{"translations":[{"hebrew":"exact input word","english":"lowercase english term"}]}

Rules:
- english must be lowercase
- Use single words or very short noun phrases that retrieve the CORRECT icon in a pictogram library
- Preserve input order; one entry per input word
- hebrew must match the input exactly
- hint is a starting guess only — override it when memory context demands a more specific pictogram label

CONTEXT RULE (critical): Read the full memory sentence and each word's sourceText. Choose the English term that matches what the narrator meant IN THIS MEMORY, not the most common dictionary gloss.

DISAMBIGUATION RULE: Prefer a slightly longer, visually specific term over a short ambiguous one when icon libraries confuse them.

Examples:
- בריכה + summer outing / swimming context → swimming pool (NOT pool — pool retrieves billiards/pool-player icons)
- נסענו + trip to forest, no named vehicle → drive or car (NOT travel — travel retrieves suitcase/airplane icons)
- נסענו באוטובוס → bus (vehicle explicit in memory)
- שרו → song; ראה → see (unchanged)

VERB RULE: If the Hebrew word is a verb or verb phrase, english MUST be a pictogram noun for that action in THIS context — never a conjugated verb, gerund, past tense, or clause.
- saw / seen → see; singing / sang → song; cooking / cooked → cooking
- traveled / travelling in a car-trip memory → drive or car, not travel
- נסענו באופניים → prefer אופניים→bicycle and נסענו→ride (NOT bicycle for both)
DUPLICATE RULE: Each english term must be unique across words when possible. If a verb and its instrument/vehicle would share the same pictogram (e.g. both → bicycle), assign the specific noun to the instrument/object and a distinct action term to the verb (ride, drive). Only repeat the same english when no distinct pictogram exists.
Non-verbs (person, object, place): use a visually specific noun (grandfather, newspaper, forest, swimming pool).`;

  const ACTION_CATEGORIES = new Set(['action', 'activity']);

  function normalizeEnglish(s) {
    return (s || '').toLowerCase().trim();
  }

  function mapEntry(raw) {
    if (!raw) return {};
    if (typeof raw === 'string') return { english: raw };
    return {
      english: raw.english || raw.canonicalReferent || '',
      category: raw.category || null,
      sourceText: raw.sourceText || null,
      hint: raw.hint || raw.english || raw.canonicalReferent || null,
    };
  }

  function isActionCategory(category) {
    return ACTION_CATEGORIES.has((category || '').toLowerCase());
  }

  function hasMemoryContext(memoryText) {
    return Boolean((memoryText || '').trim());
  }

  function buildItems(hebrewWords, canonicalMap) {
    const map = canonicalMap || {};
    return (hebrewWords || []).map((hebrew) => {
      const h = (hebrew || '').trim();
      const entry = mapEntry(map[h] || map[hebrew]);
      const english = entry.english ? normalizeEnglish(entry.english) : '';
      return {
        hebrew: h,
        english: english || undefined,
        category: entry.category || undefined,
        sourceText: entry.sourceText || undefined,
        hint: entry.hint || english || undefined,
      };
    });
  }

  async function callBatchTranslate(items, options) {
    const client = options?.client || root.MemoryEngineAnthropic;
    if (!client?.callClaudeJSON) {
      throw new Error('MemoryEngineAnthropic.callClaudeJSON is not available');
    }
    const memoryText = (options?.memoryText || '').trim();
    const payload = {
      words: items.map((i) => ({
        hebrew: i.hebrew,
        hint: i.hint || null,
        sourceText: i.sourceText || null,
        category: i.category || null,
      })),
    };
    if (memoryText) payload.memory = memoryText;
    const userPayload = JSON.stringify(payload);
    const parsed = await client.callClaudeJSON({
      max_tokens: 1024,
      messages: [
        { role: 'user', content: `${TRANSLATE_PROMPT}\n\n${userPayload}` },
      ],
    });
    const rows = parsed?.translations || [];
    const byHebrew = {};
    rows.forEach((row) => {
      const h = (row.hebrew || '').trim();
      if (h && row.english) byHebrew[h] = normalizeEnglish(row.english);
    });
    return items.map((i) => byHebrew[i.hebrew] || normalizeEnglish(i.hebrew));
  }

  function markTranslationDuplicates(translations) {
    const seen = new Map();
    return (translations || []).map((t) => {
      const en = normalizeEnglish(t.english);
      if (!en) return { ...t };
      if (seen.has(en)) {
        return { ...t, duplicateOf: seen.get(en) };
      }
      seen.set(en, t.hebrew);
      return { ...t };
    });
  }

  function uniqueTranslationsByEnglish(translations) {
    return markTranslationDuplicates(translations).filter((t) => !t.duplicateOf);
  }

  function uniqueSlotsForSequence(slots) {
    return (slots || []).filter((s) => !s.duplicateOf);
  }

  /**
   * @param {Array<{hebrew:string, english?:string, hint?:string, sourceText?:string, category?:string}>} items
   * @param {{logger?, client?, canonicalMap?, memoryText?}} options
   */
  async function translateWords(items, options) {
    const opts = options || {};
    const logger = opts.logger;
    const memoryText = (opts.memoryText || '').trim();
    const useContextAi = hasMemoryContext(memoryText);
    const list = (items || []).filter((i) => i?.hebrew?.trim());

    if (logger) {
      logger.log(STAGE, 'TRANSLATE_START', { count: list.length, contextAware: useContextAi }, 'Pictogram_Catalog_Specification');
    }

    const results = [];
    const needsAi = [];

    list.forEach((item) => {
      const hebrew = item.hebrew.trim();
      const pre = item.english ? normalizeEnglish(item.english) : '';
      const hint = item.hint ? normalizeEnglish(item.hint) : pre;
      const narratorGender = root.MemoryEngineNarratorGender;
      if (narratorGender?.isNarratorSelfWord(hebrew, pre || hint)) {
        results.push({
          hebrew,
          english: narratorGender.pictogramTermForGender(opts.narratorGender),
          source: 'narrator-gender',
          narratorRedirect: true,
          originalEnglish: pre || hint || null,
        });
        return;
      }
      const canPassThrough = pre && !isActionCategory(item.category) && !useContextAi;
      if (canPassThrough) {
        results.push({ hebrew, english: pre, source: 'semantic-analysis' });
      } else {
        needsAi.push({
          hebrew,
          hint: hint || null,
          category: item.category || null,
          sourceText: item.sourceText || null,
        });
      }
    });

    if (needsAi.length) {
      const englishList = await callBatchTranslate(needsAi, opts);
      needsAi.forEach((item, i) => {
        results.push({
          hebrew: item.hebrew,
          english: englishList[i] || item.hebrew,
          source: 'ai',
        });
      });
    }

    // Preserve original item order
    const order = list.map((i) => i.hebrew.trim());
    const byHebrew = Object.fromEntries(results.map((r) => [r.hebrew, r]));
    const narratorGender = root.MemoryEngineNarratorGender;
    const rawTranslations = order.map((h) => byHebrew[h]).filter(Boolean);
    const gendered = narratorGender
      ? narratorGender.applyToTranslations(rawTranslations, opts.narratorGender)
      : rawTranslations;
    const translations = markTranslationDuplicates(gendered);

    if (logger) {
      logger.log(
        STAGE,
        'TRANSLATE_DONE',
        {
          total: translations.length,
          unique: uniqueTranslationsByEnglish(translations).length,
          fromSemantic: translations.filter((t) => t.source === 'semantic-analysis').length,
          fromAi: translations.filter((t) => t.source === 'ai').length,
        },
        'Pictogram_Catalog_Specification'
      );
    }

    return { translations, uniqueTranslations: uniqueTranslationsByEnglish(translations) };
  }

  /**
   * Convenience: Hebrew word list + optional canonical map.
   */
  async function translateHebrewWords(hebrewWords, canonicalMap, options) {
    const items = buildItems(hebrewWords, canonicalMap);
    return translateWords(items, { ...options, canonicalMap });
  }

  function buildCanonicalMapFromRule1(rule1) {
    const map = {};
    (rule1?.representativeWords || []).forEach((rw) => {
      if (rw.word && rw.canonicalReferent) {
        map[rw.word] = {
          english: rw.canonicalReferent,
          category: rw.category || null,
          sourceText: rw.sourceText || rw.word,
        };
      }
    });
    (rule1?.considerationRecord || []).forEach((cr) => {
      if (cr.field && cr.canonicalReferent && !map[cr.field]) {
        const rw = (rule1.representativeWords || []).find((r) => r.word === cr.field);
        map[cr.field] = {
          english: cr.canonicalReferent,
          category: cr.category || null,
          sourceText: rw?.sourceText || cr.field,
        };
      }
    });
    return map;
  }

  function wordPair(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = english ? normalizeEnglish(english) : null;
    return { hebrew: h, english: e };
  }

  /**
   * Translate Hebrew representative words and resolve pictograms via Streamline mapping.
   * @returns {{ translations, slots: Array<{hebrew, english, status, svg?, source?, catalogId?, assetRef?}> }}
   */
  async function resolvePictogramWords(hebrewWords, options) {
    const opts = options || {};
    const canonicalMap = opts.canonicalMap || {};
    const { translations, uniqueTranslations } = await translateHebrewWords(hebrewWords, canonicalMap, opts);
    const translationByHebrew = Object.fromEntries(translations.map((t) => [t.hebrew, t]));
    const englishByHebrew = Object.fromEntries(translations.map((t) => [t.hebrew, t.english]));
    const resolve = opts.resolve || root.MemoryEngineCatalogResolve?.resolveForWord;
    if (!resolve) throw new Error('MemoryEngineCatalogResolve.resolveForWord is not available');

    const resolvedByEnglish = {};
    await Promise.all(
      uniqueTranslations.map(async (t) => {
        const english = t.english || null;
        if (!english || resolvedByEnglish[normalizeEnglish(english)]) return;
        const resolved = await resolve(t.hebrew, {
          english,
          englishWord: english,
          canonicalReferent: english,
          catalog: opts.catalog,
          local: opts.local,
          external: opts.external,
          narratorGender: opts.narratorGender,
        });
        resolvedByEnglish[normalizeEnglish(english)] = resolved;
      })
    );

    const slots = await Promise.all(
      (hebrewWords || []).map(async (hebrew) => {
        const h = (hebrew || '').trim();
        const translation = translationByHebrew[h] || {};
        const english = englishByHebrew[h] || null;
        const duplicateOf = translation.duplicateOf || null;
        const resolved = english ? resolvedByEnglish[normalizeEnglish(english)] : null;
        return {
          hebrew: h,
          english: resolved?.english || english,
          duplicateOf,
          narratorRedirect: translation.narratorRedirect || resolved?.narratorRedirect || false,
          originalEnglish: translation.originalEnglish || resolved?.originalEnglish || null,
          status: duplicateOf ? 'duplicate' : (resolved?.status || 'gap'),
          source: resolved?.source || null,
          svg: resolved?.svg || null,
          hash: resolved?.hash || null,
          catalogId: resolved?.catalogId || null,
          assetRef: resolved?.assetRef || null,
          entry: resolved?.entry || null,
        };
      })
    );

    const bank = opts.streamline || root.MemoryEngineCatalogStreamlineProvider;
    if (bank?.ensureBankedIcons) {
      const iconsToBank = uniqueSlotsForSequence(slots)
        .filter((s) => s.status === 'hit' && s.svg)
        .map((s) => ({ english: s.english, svg: s.svg, hash: s.hash }));
      await bank.ensureBankedIcons(iconsToBank);
    }

    return { translations, uniqueTranslations, slots, sequenceSlots: uniqueSlotsForSequence(slots) };
  }

  root.MemoryEngineCatalogTranslate = {
    translateWords,
    translateHebrewWords,
    buildItems,
    buildCanonicalMapFromRule1,
    wordPair,
    resolvePictogramWords,
    resolveBankWords: resolvePictogramWords,
    isActionCategory,
    hasMemoryContext,
    markTranslationDuplicates,
    uniqueTranslationsByEnglish,
    uniqueSlotsForSequence,
    STAGE,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
