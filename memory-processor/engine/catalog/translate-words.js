/**
 * Hebrew → English translation for pictogram search terms.
 * Reuses Rule 1 canonicalReferent when present; batch-translates the rest via Anthropic.
 */
(function (root) {
  const STAGE = '3.0';

  const TRANSLATE_PROMPT = `You translate Hebrew words into short English pictogram search terms.

INPUT: JSON array of Hebrew words.
OUTPUT: Valid JSON only. No markdown. No explanation.
{"translations":[{"hebrew":"exact input word","english":"lowercase english term"}]}

Rules:
- english must be lowercase
- Use simple noun or verb phrases suitable for pictogram library search (e.g. "grandfather", "newspaper", "we traveled")
- Preserve input order; one entry per input word
- hebrew must match the input exactly`;

  function normalizeEnglish(s) {
    return (s || '').toLowerCase().trim();
  }

  function buildItems(hebrewWords, canonicalMap) {
    const map = canonicalMap || {};
    return (hebrewWords || []).map((hebrew) => {
      const h = (hebrew || '').trim();
      const pre = map[h] || map[hebrew];
      const english = pre ? normalizeEnglish(pre) : '';
      return { hebrew: h, english: english || undefined };
    });
  }

  async function callBatchTranslate(hebrewWords, options) {
    const client = options?.client || root.MemoryEngineAnthropic;
    if (!client?.callClaudeJSON) {
      throw new Error('MemoryEngineAnthropic.callClaudeJSON is not available');
    }
    const userPayload = JSON.stringify({ words: hebrewWords });
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
    return hebrewWords.map((h) => byHebrew[h] || normalizeEnglish(h));
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
      if (pre) {
        results.push({ hebrew, english: pre, source: 'semantic-analysis' });
      } else {
        needsAi.push(hebrew);
      }
    });

    if (needsAi.length) {
      const englishList = await callBatchTranslate(needsAi, opts);
      needsAi.forEach((hebrew, i) => {
        results.push({
          hebrew,
          english: englishList[i] || hebrew,
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
      if (rw.word && rw.canonicalReferent) map[rw.word] = rw.canonicalReferent;
    });
    (rule1?.considerationRecord || []).forEach((cr) => {
      if (cr.field && cr.canonicalReferent && !map[cr.field]) map[cr.field] = cr.canonicalReferent;
    });
    return map;
  }

  function wordPair(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = english ? normalizeEnglish(english) : null;
    return { hebrew: h, english: e };
  }

  /**
   * Translate Hebrew representative words and resolve pictograms.
   * @returns {{ translations, slots: Array<{hebrew, english, status, svg?, source?, catalogId?, assetRef?}> }}
   */
  async function resolveBankWords(hebrewWords, options) {
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
    resolveBankWords,
    STAGE,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
