/**
 * Local pictogram bank — loads word-named SVG files from pictograms/bank/.
 */
(function (root) {
  const cache = new Map();

  function bankBaseUrl() {
    return '/memory-processor/pictograms/bank/';
  }

  function bankDir() {
    if (typeof window !== 'undefined') return null;
    const path = require('path');
    const fs = require('fs');
    const fromEngine = path.join(__dirname, '../pictograms/bank');
    const fromProviders = path.join(__dirname, '../../../pictograms/bank');
    if (fs.existsSync(fromEngine)) return fromEngine;
    if (fs.existsSync(fromProviders)) return fromProviders;
    return fromEngine;
  }

  function assetFilename(wordOrHebrew, entry) {
    if (entry?.asset) return entry.asset;
    const w = (wordOrHebrew || entry?.hebrew || '').trim();
    const primary = w.split('/')[0].trim();
    return primary ? `${primary}.svg` : '';
  }

  function normalizeSvg(svgText) {
    return (svgText || '').trim();
  }

  async function loadFile(filename) {
    if (!filename) return null;
    if (cache.has(filename)) return cache.get(filename);

    let svg = null;
    if (typeof window !== 'undefined') {
      const url = bankBaseUrl() + encodeURIComponent(filename);
      const res = await fetch(url);
      if (res.ok) svg = normalizeSvg(await res.text());
    } else {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(bankDir(), filename);
      if (fs.existsSync(filePath)) {
        svg = normalizeSvg(fs.readFileSync(filePath, 'utf8'));
      }
    }

    if (svg) cache.set(filename, svg);
    return svg;
  }

  async function loadByWord(word) {
    const filename = assetFilename(word);
    return filename ? loadFile(filename) : null;
  }

  async function loadByEntry(entry, matchedWord) {
    if (!entry) return null;
    if (entry.svg) return normalizeSvg(entry.svg);
    const candidates = [
      assetFilename(matchedWord || entry.hebrew, entry),
      entry.id ? `${entry.id}.svg` : '',
    ].filter(Boolean);
    for (const filename of candidates) {
      const svg = await loadFile(filename);
      if (svg) return svg;
    }
    return null;
  }

  function clearCache() {
    cache.clear();
  }

  root.MemoryEngineCatalogLocalProvider = {
    assetFilename,
    loadByWord,
    loadByEntry,
    loadFile,
    clearCache,
    bankBaseUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
