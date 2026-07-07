/**
 * Streamline HQ pictogram provider — mapping-first, then search + download.
 */
(function (root) {
  const MAPPING_API_URL = '/api/streamline-mapping';

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
    return { version: 1, icons: {} };
  }

  function ensureMappingLoadedSync() {
    if (mappingCache) return mappingCache;
    if (typeof window === 'undefined') {
      mappingCache = readMappingFromDisk();
      return mappingCache;
    }
    return mappingCache || { version: 1, icons: {} };
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
    return mappingCache.icons[key] || null;
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

  function pickIcon(results, english) {
    const list = results || [];
    if (!list.length) return null;
    const key = normalizeEnglish(english);
    const exact = list.find((r) => normalizeEnglish(r.name) === key);
    return exact || list[0];
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

  async function searchIcons(query) {
    return apiCall('search', { query });
  }

  async function downloadSvg(hash, downloadParams) {
    const params = { hash, ...(downloadParams || DEFAULT_DOWNLOAD_PARAMS) };
    return apiCall('download', params);
  }

  async function resolveIcon(english) {
    const term = normalizeEnglish(english);
    if (!term) return null;

    await loadMapping();
    const mapped = getMappedEntry(term);

    if (mapped?.hash) {
      const svg = await downloadSvg(mapped.hash, mapped.downloadParams || DEFAULT_DOWNLOAD_PARAMS);
      root.MemoryEngineStreamlineSession?.register(svg, {
        english: term,
        hash: mapped.hash,
        source: 'mapping',
      });
      return { svg, source: 'mapping', hash: mapped.hash, english: term };
    }

    const searchResult = await searchIcons(term);
    const picked = pickIcon(searchResult?.results, term);
    if (!picked?.hash) return null;

    const downloadParams = { ...DEFAULT_DOWNLOAD_PARAMS };
    const svg = await downloadSvg(picked.hash, downloadParams);
    const entry = {
      hash: picked.hash,
      iconName: picked.name || term,
      downloadParams,
      searchQuery: term,
      updatedAt: new Date().toISOString(),
    };
    await saveMappingEntry(term, entry);

    root.MemoryEngineStreamlineSession?.register(svg, {
      english: term,
      hash: picked.hash,
      source: 'streamline-new',
    });
    return { svg, source: 'streamline-new', hash: picked.hash, english: term };
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
    searchIcons,
    downloadSvg,
    resolveIcon,
    fetchPictogram,
    clearMappingCache,
    DEFAULT_DOWNLOAD_PARAMS,
    normalizeEnglish,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
