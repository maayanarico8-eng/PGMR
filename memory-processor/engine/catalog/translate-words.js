/**
 * Hebrew → English translation for pictogram search terms.
 * Reuses Rule 1 canonicalReferent when present; batch-translates the rest via Anthropic.
 */
(function (root) {
  const STAGE = '3.0';

  const TRANSLATE_PROMPT = `You translate Hebrew words into short English pictogram search terms.

INPUT: JSON array of Hebrew words (optional "hint" per word from prior semantic analysis).
OUTPUT: Valid JSON only. No markdown. No explanation.
{"translations":[{"hebrew":"exact input word","english":"lowercase english term"}]}

Rules:
- english must be lowercase
- Use single words or very short noun phrases suitable for pictogram library search
- Preserve input order; one entry per input word
- hebrew must match the input exactly

VERB RULE (critical): If the Hebrew word is a verb or verb phrase, english MUST be the pictogram noun for that action — never a conjugated verb, gerund, past tense, or clause.
Convert any hint that is a verb form to its noun (or base pictogram label):
- traveled / travelling / we traveled → travel
- saw / seen → see
- singing / sang → song
- cooking / cooked → cooking
- reading / read → reading
When a dedicated noun exists, prefer it (travel, song). When the pictogram convention uses the base infinitive, use that (see, run, eat).
Non-verbs (person, object, place): use a simple noun (grandfather, newspaper, forest).`;

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
      hint: raw.hint || raw.english || raw.canonicalReferent || null,
    };
  }

  function isActionCategory(category) {
    return ACTION_CATEGORIES.has((category || '').toLowerCase());
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
        hint: entry.hint || english || undefined,
      };
    });
  }

  async function callBatchTranslate(items, options) {
    const client = options?.client || root.MemoryEngineAnthropic;
    if (!client?.callClaudeJSON) {
      throw new Error('MemoryEngineAnthropic.callClaudeJSON is not available');
    }
    const userPayload = JSON.stringify({
      words: items.map((i) => ({
        hebrew: i.hebrew,
        hint: i.hint || null,
      })),
    });
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

  /**
   * @param {Array<{hebrew:string, english?:string}>} items
   * @param {{logger?, client?, canonicalMap?}} options
   */
  async function translateWords(items, options) {
    const opts = options || {};
    const logger = opts.logger;
    const list = (items || []).filter((i) => i?.hebrew?.trim());

    if (logger) {
      logger.log(STAGE, 'TRANSLATE_START', { count: list.length }, 'Pictogram_Catalog_Specification');
    }

    const results = [];
    const needsAi = [];

    list.forEach((item) => {
      const hebrew = item.hebrew.trim();
      const pre = item.english ? normalizeEnglish(item.english) : '';
      const hint = item.hint ? normalizeEnglish(item.hint) : pre;
      if (pre && !isActionCategory(item.category)) {
        results.push({ hebrew, english: pre, source: 'semantic-analysis' });
      } else {
        needsAi.push({ hebrew, hint: hint || null, category: item.category || null });
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
    const translations = order.map((h) => byHebrew[h]).filter(Boolean);

    if (logger) {
      logger.log(
        STAGE,
        'TRANSLATE_DONE',
        {
          total: translations.length,
          fromSemantic: translations.filter((t) => t.source === 'semantic-analysis').length,
          fromAi: translations.filter((t) => t.source === 'ai').length,
        },
        'Pictogram_Catalog_Specification'
      );
    }

    return { translations };
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
        map[rw.word] = { english: rw.canonicalReferent, category: rw.category || null };
      }
    });
    (rule1?.considerationRecord || []).forEach((cr) => {
      if (cr.field && cr.canonicalReferent && !map[cr.field]) {
        map[cr.field] = { english: cr.canonicalReferent, category: cr.category || null };
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
    const { translations } = await translateHebrewWords(hebrewWords, canonicalMap, opts);
    const englishByHebrew = Object.fromEntries(
      translations.map((t) => [t.hebrew, t.english])
    );
    const resolve = opts.resolve || root.MemoryEngineCatalogResolve?.resolveForWord;
    if (!resolve) throw new Error('MemoryEngineCatalogResolve.resolveForWord is not available');

    const slots = await Promise.all(
      (hebrewWords || []).map(async (hebrew) => {
        const h = (hebrew || '').trim();
        const english = englishByHebrew[h] || null;
        const resolved = await resolve(h, {
          english,
          englishWord: english,
          canonicalReferent: english,
          catalog: opts.catalog,
          local: opts.local,
          external: opts.external,
        });
        return {
          hebrew: h,
          english: resolved.english || english,
          status: resolved.status || 'gap',
          source: resolved.source || null,
          svg: resolved.svg || null,
          catalogId: resolved.catalogId || null,
          assetRef: resolved.assetRef || null,
          entry: resolved.entry || null,
        };
      })
    );

    return { translations, slots };
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
    STAGE,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
