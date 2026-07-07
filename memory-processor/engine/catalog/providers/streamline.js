/**
 * Streamline HQ pictogram provider — mapping-first, family search, then download.
 */
(function (root) {
  const MAPPING_API_URL = '/api/streamline-mapping';

  const DEFAULT_SEARCH_PARAMS = {
    mode: 'family',
    familySlug: 'core-line-free',
    limit: 10,
  };

  const DEFAULT_DOWNLOAD_PARAMS = {
    size: 64,
    responsive: true,
    strokeToFill: false,
    colors: '',
    backgroundColor: '#ffffff00',
  };

  let mappingCache = null;
  let mappingLoadPromise = null;

  function normalizeEnglish(s) {
    return (s || '').toLowerCase().trim();
  }

  function isPremiumDownloadError(message) {
    return /paying customers|premium|forbidden|not have access|don't have access/i.test(message || '');
  }

  function isMappedEntryCurrent(entry) {
    const sp = entry?.searchParams;
    return (
      sp?.mode === DEFAULT_SEARCH_PARAMS.mode &&
      sp?.familySlug === DEFAULT_SEARCH_PARAMS.familySlug
    );
  }

  function mappingFileCandidates() {
    if (typeof window !== 'undefined') return [];
    const path = require('path');
    return [
      path.join(__dirname, '../../pictograms/streamline-mapping.json'),
      path.join(__dirname, '../../../pictograms/streamline-mapping.json'),
    ];
  }

  function readMappingFromDisk() {
    const fs = require('fs');
    for (const file of mappingFileCandidates()) {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    }
    return { version: 2, meta: { searchMode: 'family', familySlug: 'core-line-free' }, icons: {} };
  }

  function ensureMappingLoadedSync() {
    if (mappingCache) return mappingCache;
    if (typeof window === 'undefined') {
      mappingCache = readMappingFromDisk();
      return mappingCache;
    }
    return mappingCache || { version: 2, icons: {} };
  }

  async function loadMapping(force) {
    if (mappingCache && !force) return mappingCache;
    if (mappingLoadPromise && !force) return mappingLoadPromise;

    if (typeof window === 'undefined') {
      mappingCache = readMappingFromDisk();
      return mappingCache;
    }

    mappingLoadPromise = (async () => {
      const res = await fetch(MAPPING_API_URL);
      if (!res.ok) throw new Error(`Failed to load streamline mapping (${res.status})`);
      mappingCache = await res.json();
      return mappingCache;
    })();

    return mappingLoadPromise;
  }

  function getMappedEntry(english) {
    ensureMappingLoadedSync();
    const key = normalizeEnglish(english);
    if (!key || !mappingCache?.icons) return null;
    const entry = mappingCache.icons[key] || null;
    if (entry && !isMappedEntryCurrent(entry)) return null;
    return entry;
  }

  function hasMapping(english) {
    return !!getMappedEntry(english)?.hash;
  }

  async function saveMappingEntry(english, entry) {
    const key = normalizeEnglish(english);
    await loadMapping();
    if (!mappingCache.icons) mappingCache.icons = {};
    mappingCache.icons[key] = entry;

    try {
      const res = await fetch('/api/streamline-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english: key, entry }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('streamline-mapping save:', body.error?.message || res.status);
      } else {
        const body = await res.json().catch(() => ({}));
        if (body.entry && mappingCache?.icons) {
          mappingCache.icons[key] = body.entry;
        }
      }
    } catch (err) {
      console.warn('streamline-mapping save error:', err.message);
    }
  }

  function rankIconCandidates(results, english) {
    const list = results || [];
    if (!list.length) return [];
    const key = normalizeEnglish(english);
    const free = list.filter((r) => r.isFree);
    const pool = free.length ? free : list;
    const exact = pool.find((r) => normalizeEnglish(r.name) === key);
    const rest = pool.filter((r) => r !== exact);
    return exact ? [exact, ...rest] : pool;
  }

  function pickIcon(results, english) {
    return rankIconCandidates(results, english)[0] || null;
  }

  async function apiCall(action, params) {
    const qs = new URLSearchParams({ action });
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    const res = await fetch(`/api/streamline?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error?.message || `Streamline API ${res.status}`);
    }
    if (action === 'download') return body.svg;
    return body;
  }

  async function searchIcons(query, searchParams) {
    const sp = { ...DEFAULT_SEARCH_PARAMS, ...(searchParams || {}) };
    return apiCall('family-search', {
      query,
      familySlug: sp.familySlug,
      limit: sp.limit,
      offset: sp.offset,
    });
  }

  async function downloadSvg(hash, downloadParams) {
    const params = { hash, ...(downloadParams || DEFAULT_DOWNLOAD_PARAMS) };
    return apiCall('download', params);
  }

  async function tryDownloadCandidates(candidates, downloadParams) {
    for (const icon of candidates) {
      if (!icon?.hash) continue;
      try {
        const svg = await downloadSvg(icon.hash, downloadParams);
        return { svg, icon };
      } catch (err) {
        if (isPremiumDownloadError(err.message)) continue;
        throw err;
      }
    }
    return { svg: null, icon: null };
  }

  async function resolveFromSearch(term, searchParams) {
    const searchResult = await searchIcons(term, searchParams);
    const candidates = rankIconCandidates(searchResult?.results, term);
    if (!candidates.length) return null;

    const downloadParams = { ...DEFAULT_DOWNLOAD_PARAMS };
    const sp = { ...DEFAULT_SEARCH_PARAMS, ...(searchParams || {}) };
    const { svg, icon } = await tryDownloadCandidates(candidates, downloadParams);
    if (!svg || !icon) return null;

    const entry = {
      hash: icon.hash,
      iconName: icon.name || term,
      familySlug: sp.familySlug,
      downloadParams,
      searchParams: sp,
      searchQuery: term,
      updatedAt: new Date().toISOString(),
    };
    await saveMappingEntry(term, entry);

    root.MemoryEngineStreamlineSession?.register(svg, {
      english: term,
      hash: icon.hash,
      source: 'streamline-new',
    });
    return { svg, source: 'streamline-new', hash: icon.hash, english: term };
  }

  async function resolveIcon(english) {
    const term = normalizeEnglish(english);
    if (!term) return null;

    await loadMapping();
    const mapped = getMappedEntry(term);

    if (mapped?.hash) {
      try {
        const svg = await downloadSvg(mapped.hash, mapped.downloadParams || DEFAULT_DOWNLOAD_PARAMS);
        root.MemoryEngineStreamlineSession?.register(svg, {
          english: term,
          hash: mapped.hash,
          source: 'mapping',
        });
        return { svg, source: 'mapping', hash: mapped.hash, english: term };
      } catch (err) {
        if (!isPremiumDownloadError(err.message)) throw err;
        if (mappingCache?.icons) delete mappingCache.icons[term];
      }
    }

    return resolveFromSearch(term, DEFAULT_SEARCH_PARAMS);
  }

  async function fetchPictogram({ english, canonicalReferent, englishWord }) {
    const term = english || englishWord || canonicalReferent;
    if (!term) return null;
    return resolveIcon(term);
  }

  function clearMappingCache() {
    mappingCache = null;
    mappingLoadPromise = null;
  }

  root.MemoryEngineCatalogStreamlineProvider = {
    loadMapping,
    ensureMappingLoadedSync,
    getMappedEntry,
    hasMapping,
    saveMappingEntry,
    pickIcon,
    rankIconCandidates,
    searchIcons,
    downloadSvg,
    tryDownloadCandidates,
    resolveIcon,
    fetchPictogram,
    clearMappingCache,
    DEFAULT_SEARCH_PARAMS,
    DEFAULT_DOWNLOAD_PARAMS,
    normalizeEnglish,
    isPremiumDownloadError,
    isMappedEntryCurrent,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
