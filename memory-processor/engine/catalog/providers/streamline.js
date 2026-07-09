/**
 * Streamline HQ pictogram provider — mapping-first, family search, then download.
 * SVG bytes are stored in pictogram-cache (Blob/disk), not in the mapping file.
 * Download params: https://docs.streamlinehq.com/reference/downloadiconassvg
 */
(function (root) {
  const MAPPING_API_URL = '/api/streamline-mapping';
  const CACHE_API_URL = '/api/pictogram-cache';

  const DEFAULT_FAMILY_SLUG = 'streamline-regular';

  const DEFAULT_SEARCH_PARAMS = {
    mode: 'family',
    familySlug: DEFAULT_FAMILY_SLUG,
    limit: 10,
  };

  /** Maayan-aligned export settings for 64×64 pictogram references */
  const DEFAULT_DOWNLOAD_PARAMS = {
    size: 64,
    responsive: true,
    strokeToFill: false,
    backgroundColor: '#ffffff00',
    colors: '#000000',
    strokeWidth: 1,
  };

  let mappingCache = null;
  let mappingLoadPromise = null;
  const svgCacheMemory = {};

  function normalizeEnglish(s) {
    return (s || '').toLowerCase().trim();
  }

  function isPremiumDownloadError(message) {
    return /paying customers|premium|forbidden|not have access|don't have access/i.test(message || '');
  }

  function isFreeFamily(familySlug) {
    return String(familySlug || '').endsWith('-free');
  }

  function isMappedEntryCurrent(entry) {
    const sp = entry?.searchParams;
    return (
      sp?.mode === DEFAULT_SEARCH_PARAMS.mode &&
      sp?.familySlug === DEFAULT_SEARCH_PARAMS.familySlug
    );
  }

  function pictogramsDir() {
    if (typeof window !== 'undefined') return null;
    const path = require('path');
    return path.join(__dirname, '../../../pictograms');
  }

  function mappingFileCandidates() {
    const dir = pictogramsDir();
    if (!dir) return [];
    const path = require('path');
    return [path.join(dir, 'streamline-mapping.json')];
  }

  function cacheFileCandidates() {
    const dir = pictogramsDir();
    if (!dir) return [];
    const path = require('path');
    return [path.join(dir, 'pictogram-cache.json')];
  }

  function readMappingFromDisk() {
    const fs = require('fs');
    for (const file of mappingFileCandidates()) {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    }
    return {
      version: 2,
      meta: { searchMode: 'family', familySlug: DEFAULT_FAMILY_SLUG },
      icons: {},
    };
  }

  function readCacheFromDisk() {
    const fs = require('fs');
    for (const file of cacheFileCandidates()) {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    }
    return { version: 1, icons: {} };
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

  function hasCachedSvg(english) {
    const key = normalizeEnglish(english);
    if (!key) return false;
    if (svgCacheMemory[key]?.svg) return true;
    if (typeof window === 'undefined') {
      const cache = readCacheFromDisk();
      return !!cache.icons?.[key]?.svg;
    }
    return false;
  }

  function mappingEntryForSave(entry) {
    if (!entry) return entry;
    const { svg, ...rest } = entry;
    return rest;
  }

  async function saveMappingEntry(english, entry) {
    const key = normalizeEnglish(english);
    await loadMapping();
    if (!mappingCache.icons) mappingCache.icons = {};
    const stored = mappingEntryForSave(entry);
    mappingCache.icons[key] = stored;

    if (typeof window === 'undefined') {
      const fs = require('fs');
      for (const file of mappingFileCandidates()) {
        fs.mkdirSync(require('path').dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(mappingCache, null, 2)}\n`, 'utf8');
        return true;
      }
      return false;
    }

    try {
      const res = await fetch(MAPPING_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english: key, entry: stored }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('streamline-mapping save:', body.error?.message || res.status);
        return false;
      }
      const body = await res.json().catch(() => ({}));
      if (body.entry && mappingCache?.icons) {
        mappingCache.icons[key] = body.entry;
      }
      return true;
    } catch (err) {
      console.warn('streamline-mapping save error:', err.message);
      return false;
    }
  }

  async function deleteMappingEntry(english) {
    const key = normalizeEnglish(english);
    if (!key) return false;
    await loadMapping();
    if (mappingCache?.icons?.[key]) delete mappingCache.icons[key];

    if (typeof window === 'undefined') {
      const fs = require('fs');
      const mapping = readMappingFromDisk();
      if (!mapping.icons?.[key]) return false;
      delete mapping.icons[key];
      for (const file of mappingFileCandidates()) {
        fs.mkdirSync(require('path').dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
        return true;
      }
      return false;
    }

    try {
      const res = await fetch(`${MAPPING_API_URL}?english=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.status === 404) return true;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('streamline-mapping delete:', body.error?.message || res.status);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('streamline-mapping delete error:', err.message);
      return false;
    }
  }

  async function getCachedEntry(english) {
    const key = normalizeEnglish(english);
    if (!key) return null;
    if (svgCacheMemory[key]?.svg) return svgCacheMemory[key];

    if (typeof window === 'undefined') {
      const cache = readCacheFromDisk();
      const entry = cache.icons?.[key] || null;
      if (entry?.svg) svgCacheMemory[key] = entry;
      return entry;
    }

    try {
      const res = await fetch(`${CACHE_API_URL}?english=${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const body = await res.json();
      if (body.entry?.svg) {
        svgCacheMemory[key] = body.entry;
        return body.entry;
      }
    } catch (err) {
      console.warn('pictogram-cache read error:', err.message);
    }
    return null;
  }

  async function loadCache() {
    if (typeof window === 'undefined') {
      return readCacheFromDisk();
    }
    const res = await fetch(CACHE_API_URL);
    if (!res.ok) throw new Error(`Failed to load pictogram cache (${res.status})`);
    return res.json();
  }

  async function deleteCacheEntry(english) {
    const key = normalizeEnglish(english);
    if (!key) return false;
    delete svgCacheMemory[key];

    if (typeof window === 'undefined') {
      const fs = require('fs');
      const path = require('path');
      const cache = readCacheFromDisk();
      if (!cache.icons?.[key]) return false;
      delete cache.icons[key];
      for (const file of cacheFileCandidates()) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
        return true;
      }
      return false;
    }

    try {
      const res = await fetch(`${CACHE_API_URL}?english=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.status === 404) return true;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('pictogram-cache delete:', body.error?.message || res.status);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('pictogram-cache delete error:', err.message);
      return false;
    }
  }

  async function saveCacheEntry(english, entry) {
    const key = normalizeEnglish(english);
    if (!key || !entry?.svg) return false;
    const stored = {
      svg: entry.svg,
      hash: entry.hash || null,
      cachedAt: entry.cachedAt || new Date().toISOString(),
    };
    svgCacheMemory[key] = stored;

    if (typeof window === 'undefined') {
      const fs = require('fs');
      const path = require('path');
      const cache = readCacheFromDisk();
      if (!cache.icons) cache.icons = {};
      cache.icons[key] = stored;
      for (const file of cacheFileCandidates()) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
        return true;
      }
      return false;
    }

    try {
      const res = await fetch(CACHE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english: key, entry: stored }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('pictogram-cache save:', body.error?.message || res.status);
        return false;
      }
      const body = await res.json().catch(() => ({}));
      if (body.entry) svgCacheMemory[key] = body.entry;
      return true;
    } catch (err) {
      console.warn('pictogram-cache save error:', err.message);
      return false;
    }
  }

  /** Legacy: mapping entries may still carry inline svg from older builds. */
  async function migrateLegacyInlineSvg(term, mapped) {
    if (!mapped?.svg) return null;
    await saveCacheEntry(term, { svg: mapped.svg, hash: mapped.hash });
    await saveMappingEntry(term, mapped);
    return mapped.svg;
  }

  function rankIconCandidates(results, english, familySlug) {
    const list = results || [];
    if (!list.length) return [];
    const key = normalizeEnglish(english);
    const slug = familySlug || DEFAULT_FAMILY_SLUG;
    const free = list.filter((r) => r.isFree);
    const pool = isFreeFamily(slug) && free.length ? free : list;
    const exact = pool.find((r) => normalizeEnglish(r.name) === key);
    const rest = pool.filter((r) => r !== exact);
    return exact ? [exact, ...rest] : pool;
  }

  function pickIcon(results, english, familySlug) {
    return rankIconCandidates(results, english, familySlug)[0] || null;
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

  function registerSession(svg, meta) {
    root.MemoryEngineStreamlineSession?.register?.(svg, meta);
  }

  function returnSvg(term, svg, hash, source) {
    registerSession(svg, { english: term, hash, source });
    return { svg, source, hash, english: term };
  }

  async function resolveFromSearch(term, searchParams) {
    const searchResult = await searchIcons(term, searchParams);
    const sp = { ...DEFAULT_SEARCH_PARAMS, ...(searchParams || {}) };
    const candidates = rankIconCandidates(searchResult?.results, term, sp.familySlug);
    if (!candidates.length) return null;

    const downloadParams = { ...DEFAULT_DOWNLOAD_PARAMS };
    const { svg, icon } = await tryDownloadCandidates(candidates, downloadParams);
    if (!svg || !icon) return null;

    const mappingEntry = {
      hash: icon.hash,
      iconName: icon.name || term,
      familySlug: sp.familySlug,
      downloadParams,
      searchParams: sp,
      searchQuery: term,
      updatedAt: new Date().toISOString(),
    };
    await saveMappingEntry(term, mappingEntry);
    await saveCacheEntry(term, { svg, hash: icon.hash });

    return returnSvg(term, svg, icon.hash, 'streamline-new');
  }

  async function resolveIcon(english) {
    const term = normalizeEnglish(english);
    if (!term) return null;

    const sessionCached = root.MemoryEngineStreamlineSession?.getByEnglish?.(term);
    if (sessionCached?.svg) {
      return {
        svg: sessionCached.svg,
        source: sessionCached.meta?.source || 'cache',
        hash: sessionCached.meta?.hash || null,
        english: term,
      };
    }

    const cached = await getCachedEntry(term);
    if (cached?.svg) {
      return returnSvg(term, cached.svg, cached.hash, 'cache');
    }

    await loadMapping();
    const mapped = getMappedEntry(term);

    if (mapped) {
      const legacySvg = await migrateLegacyInlineSvg(term, mapped);
      if (legacySvg) {
        return returnSvg(term, legacySvg, mapped.hash, 'cache');
      }
    }

    if (mapped?.hash) {
      try {
        const svg = await downloadSvg(mapped.hash, mapped.downloadParams || DEFAULT_DOWNLOAD_PARAMS);
        await saveCacheEntry(term, { svg, hash: mapped.hash });
        return returnSvg(term, svg, mapped.hash, 'mapping');
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
    Object.keys(svgCacheMemory).forEach((k) => delete svgCacheMemory[k]);
  }

  root.MemoryEngineCatalogStreamlineProvider = {
    loadMapping,
    ensureMappingLoadedSync,
    getMappedEntry,
    getCachedEntry,
    hasMapping,
    hasCachedSvg,
    saveMappingEntry,
    deleteMappingEntry,
    saveCacheEntry,
    loadCache,
    deleteCacheEntry,
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
    DEFAULT_FAMILY_SLUG,
    normalizeEnglish,
    isPremiumDownloadError,
    isMappedEntryCurrent,
    isFreeFamily,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
