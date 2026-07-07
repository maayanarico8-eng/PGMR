/**
 * External pictogram provider — delegates to Streamline HQ.
 */
(function (root) {
  const streamline = () => root.MemoryEngineCatalogStreamlineProvider;

  async function fetchPictogram(opts) {
    const sl = streamline();
    if (!sl?.fetchPictogram) return null;
    return sl.fetchPictogram(opts || {});
  }

  root.MemoryEngineCatalogExternalProvider = { fetchPictogram };
})(typeof globalThis !== 'undefined' ? globalThis : window);
