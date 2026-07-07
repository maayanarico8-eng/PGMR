/**
 * Pictogram resolver — bank first, external fallback (future).
 * All results include hebrew + english word pair for client UX / API search.
 */
(function (root) {
  const local = () => root.MemoryEngineCatalogLocalProvider;
  const external = () => root.MemoryEngineCatalogExternalProvider;
  const catalog = () => root.MemoryEngineCatalog;

  function pair(hebrew, english) {
    const h = (hebrew || '').trim();
    const e = english ? String(english).toLowerCase().trim() : null;
    return { hebrew: h, english: e };
  }

  function withPair(result, hebrew, english) {
    const p = pair(hebrew, english);
    return { ...result, ...p };
  }

  async function resolveEntry(entry, matchedWord, options) {
    const hebrew = (matchedWord || entry?.hebrew || '').trim();
    const english = options?.english || options?.englishWord || null;
    if (!entry) return withPair({ status: 'gap', svg: null, source: null }, hebrew, english);

    const loc = options?.local || local();
    const svg = await loc.loadByEntry(entry, matchedWord);
    if (svg) {
      return withPair(
        {
          status: 'hit',
          source: 'bank',
          catalogId: entry.id,
          entry,
          svg,
          assetRef: loc.assetFilename(matchedWord || entry.hebrew, entry),
        },
        hebrew,
        english
      );
    }

    if (entry.svg) {
      return withPair(
        {
          status: 'hit',
          source: 'bank',
          catalogId: entry.id,
          entry,
          svg: entry.svg,
          assetRef: null,
        },
        hebrew,
        english
      );
    }

    return withPair(
      {
        status: 'gap',
        catalogId: entry.id,
        entry,
        svg: null,
        source: null,
      },
      hebrew,
      english
    );
  }

  async function resolveForWord(word, options) {
    const cat = options?.catalog || catalog();
    const loc = options?.local || local();
    const ext = options?.external || external();
    const hebrew = (word || '').trim();
    const english = options?.english || options?.englishWord || options?.canonicalReferent || null;

    const entry = cat.lookup(word);
    if (entry) {
      const resolved = await resolveEntry(entry, word, { local: loc, english });
      if (resolved.status === 'hit') return resolved;
    }

    const cr = options?.canonicalReferent;
    if (cr && cr !== word) {
      const byCanon = cat.lookup(cr);
      if (byCanon) {
        const resolved = await resolveEntry(byCanon, word, { local: loc, english });
        if (resolved.status === 'hit') return resolved;
      }
    }

    const extResult = await ext.fetchPictogram({
      hebrew,
      english,
      word: hebrew,
      englishWord: english,
      canonicalReferent: cr || english || null,
    });
    if (extResult?.svg) {
      return withPair(
        {
          status: 'hit',
          source: 'external',
          svg: extResult.svg,
          provisional: true,
          assetRef: null,
        },
        hebrew,
        english
      );
    }

    return withPair({ status: 'gap', svg: null, source: null }, hebrew, english);
  }

  root.MemoryEngineCatalogResolve = {
    resolveForWord,
    resolveEntry,
    pair,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
