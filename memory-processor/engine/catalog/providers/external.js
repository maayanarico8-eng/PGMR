/**
 * External pictogram provider — stub for future API/CDN fallback on bank miss.
 * Primary search key: english (translated representative term); hebrew for display.
 */
(function (root) {
  async function fetchPictogram({ hebrew, english, word, englishWord, canonicalReferent }) {
    void hebrew;
    void english;
    void word;
    void englishWord;
    void canonicalReferent;
    return null;
  }

  root.MemoryEngineCatalogExternalProvider = { fetchPictogram };
})(typeof globalThis !== 'undefined' ? globalThis : window);
