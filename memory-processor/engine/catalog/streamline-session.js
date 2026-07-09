/**
 * Session-scoped Streamline SVG cache — cleared when a new analysis starts.
 */
(function (root) {
  const active = [];
  const blobUrls = [];

  function register(svg, meta) {
    active.push({ svg, meta: meta || {}, at: Date.now() });
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

  function cleanup() {
    active.length = 0;
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
    cleanup,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
