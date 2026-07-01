/**
 * External pictogram provider — stub for future API/CDN fallback on bank miss.
 */
(function (root) {
  async function fetchPictogram({ word, canonicalReferent }) {
    void word;
    void canonicalReferent;
    return null;
  }

  root.MemoryEngineCatalogExternalProvider = { fetchPictogram };
})(typeof globalThis !== 'undefined' ? globalThis : window);
