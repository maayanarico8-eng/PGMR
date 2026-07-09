/**
 * Pictogram resolver — Streamline reference → Haiku Maayan realization → cache.
 * All results include hebrew + english word pair for client UX.
 */
(function (root) {
  const realize = () => root.MemoryEngineCatalogPictogramRealizeProvider;

  function pair(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = english ? String(english).toLowerCase().trim() : null;
    return { hebrew: h, english: e };
  }

  function withPair(result, hebrew, english) {
    return { ...result, ...pair(hebrew, english) };
  }

  async function resolveForWord(word, options) {
    const provider = options?.realize || realize();
    const hebrew = (word || '').trim();
    const english = options?.english || options?.englishWord || options?.canonicalReferent || null;

    if (!english) {
      return withPair({ status: 'gap', svg: null, source: null }, hebrew, null);
    }

    if (!provider?.resolveIcon) {
      return withPair({ status: 'gap', svg: null, source: null }, hebrew, english);
    }

    try {
      const result = await provider.resolveIcon(english, { ...options, hebrew, english });
      if (result?.svg) {
        return withPair(
          {
            status: 'hit',
            source: result.source,
            svg: result.svg,
            assetRef: `maayan://${result.hash || english}`,
            hash: result.hash,
            provisional: result.source === 'generated',
          },
          hebrew,
          english
        );
      }
    } catch (err) {
      console.warn('Pictogram realize failed:', err.message);
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
