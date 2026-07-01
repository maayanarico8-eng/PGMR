/**
 * Pictogram resolver — bank first, external fallback (future).
 */
(function (root) {
  const local = () => root.MemoryEngineCatalogLocalProvider;
  const external = () => root.MemoryEngineCatalogExternalProvider;
  const catalog = () => root.MemoryEngineCatalog;

  async function resolveEntry(entry, matchedWord, options) {
    if (!entry) return { status: 'gap', word: matchedWord || null, svg: null, source: null };

    const loc = options?.local || local();
    const svg = await loc.loadByEntry(entry, matchedWord);
    if (svg) {
      const word = matchedWord || entry.hebrew || '';
      return {
        status: 'hit',
        source: 'bank',
        word,
        catalogId: entry.id,
        entry,
        svg,
        assetRef: loc.assetFilename(matchedWord || entry.hebrew, entry),
      };
    }

    if (entry.svg) {
      return {
        status: 'hit',
        source: 'bank',
        word: matchedWord || entry.hebrew,
        catalogId: entry.id,
        entry,
        svg: entry.svg,
        assetRef: null,
      };
    }

    return {
      status: 'gap',
      word: matchedWord || entry.hebrew,
      catalogId: entry.id,
      entry,
      svg: null,
      source: null,
    };
  }

  async function resolveForWord(word, options) {
    const cat = options?.catalog || catalog();
    const loc = options?.local || local();
    const ext = options?.external || external();

    const entry = cat.lookup(word);
    if (entry) {
      const resolved = await resolveEntry(entry, word, { local: loc });
      if (resolved.status === 'hit') return resolved;
    }

    const cr = options?.canonicalReferent;
    if (cr && cr !== word) {
      const byCanon = cat.lookup(cr);
      if (byCanon) {
        const resolved = await resolveEntry(byCanon, word, { local: loc });
        if (resolved.status === 'hit') return resolved;
      }
    }

    const extResult = await ext.fetchPictogram({
      word,
      canonicalReferent: cr || null,
    });
    if (extResult?.svg) {
      return {
        status: 'hit',
        source: 'external',
        word,
        svg: extResult.svg,
        provisional: true,
        assetRef: null,
      };
    }

    return { status: 'gap', word, svg: null, source: null };
  }

  root.MemoryEngineCatalogResolve = {
    resolveForWord,
    resolveEntry,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
