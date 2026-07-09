/**
 * Pictogram resolver — mapping-first Streamline HQ (no local bank).
 * All results include hebrew + english word pair for client UX.
 */
(function (root) {
  const streamline = () => root.MemoryEngineCatalogStreamlineProvider;

  function pair(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = english ? String(english).toLowerCase().trim() : null;
    return { hebrew: h, english: e };
  }

  function withPair(result, hebrew, english) {
    return { ...result, ...pair(hebrew, english) };
  }

  async function resolveForWord(word, options) {
    const sl = options?.streamline || streamline();
    const hebrew = (word || '').trim();
    const rawEnglish = options?.english || options?.englishWord || options?.canonicalReferent || null;
    const narratorGender = root.MemoryEngineNarratorGender;
    const english = narratorGender
      ? narratorGender.resolveEnglishForPictogram(hebrew, rawEnglish, options?.narratorGender)
      : rawEnglish;

    if (!english) {
      return withPair({ status: 'gap', svg: null, source: null }, hebrew, null);
    }

    const narratorRedirect = narratorGender?.isNarratorSelfWord(hebrew, rawEnglish) || false;

    if (!sl?.resolveIcon) {
      return withPair({ status: 'gap', svg: null, source: null }, hebrew, english);
    }

    try {
      const result = await sl.resolveIcon(english, options);
      if (result?.svg) {
        return withPair(
          {
            status: 'hit',
            source: result.source,
            svg: result.svg,
            assetRef: `streamline://${result.hash || english}`,
            hash: result.hash,
            provisional: result.source === 'streamline-new',
            narratorRedirect,
            originalEnglish: narratorRedirect ? rawEnglish : undefined,
          },
          hebrew,
          english
        );
      }
    } catch (err) {
      console.warn('Streamline resolve failed:', err.message);
    }

    return withPair({ status: 'gap', svg: null, source: null }, hebrew, english);
  }

  /** @deprecated Use resolveForWord — kept for callers that still pass catalog entries. */
  async function resolveEntry(entry, matchedWord, options) {
    const english =
      options?.english ||
      options?.englishWord ||
      (entry?.concept ? String(entry.concept).toLowerCase().split('/')[0].trim() : null);
    return resolveForWord(matchedWord || entry?.hebrew, { ...options, english });
  }

  root.MemoryEngineCatalogResolve = {
    resolveForWord,
    resolveEntry,
    pair,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
