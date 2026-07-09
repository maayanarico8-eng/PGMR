/**
 * External pictogram provider — Streamline reference + Haiku Maayan realization.
 */
(function (root) {
  const realize = () => root.MemoryEngineCatalogPictogramRealizeProvider;

  async function fetchPictogram(opts) {
    const pr = realize();
    if (!pr?.fetchPictogram) return null;
    return pr.fetchPictogram(opts || {});
  }

  root.MemoryEngineCatalogExternalProvider = { fetchPictogram };
})(typeof globalThis !== 'undefined' ? globalThis : window);
