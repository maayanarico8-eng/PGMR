/**
 * Session-scoped Streamline SVG cache — cleared when a new analysis starts.
 * Also tracks pictogram hashes already used in the current analyze run so
 * two different representative words cannot share the same icon.
 */
(function (root) {
  const active = [];
  const blobUrls = [];
  const usedHashes = new Set();

  function register(svg, meta) {
    const m = meta || {};
    active.push({ svg, meta: m, at: Date.now() });
    if (m.hash) usedHashes.add(String(m.hash));
  }

  function trackBlobUrl(url) {
    if (url) blobUrls.push(url);
  }

  function getActive() {
    return active.slice();
  }

  function getByEnglish(english) {
    const key = (english || '').toLowerCase().trim();
    if (!key) return null;
    for (let i = active.length - 1; i >= 0; i--) {
      const item = active[i];
      if ((item.meta?.english || '').toLowerCase().trim() === key) return item;
    }
    return null;
  }

  /** Hashes already assigned to a word in this analyze session. */
  function getUsedHashes() {
    return Array.from(usedHashes);
  }

  function isHashUsed(hash) {
    return !!(hash && usedHashes.has(String(hash)));
  }

  function cleanup() {
    active.length = 0;
    usedHashes.clear();
    if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    }
    blobUrls.length = 0;
  }

  root.MemoryEngineStreamlineSession = {
    register,
    trackBlobUrl,
    getActive,
    getByEnglish,
    getUsedHashes,
    isHashUsed,
    cleanup,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
