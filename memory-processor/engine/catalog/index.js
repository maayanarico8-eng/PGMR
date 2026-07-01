/**
 * Pictogram catalog — lookup API shared between browser and CLI.
 */
(function (root) {
  const entries = root.MemoryEngineCatalogEntries || [];
  let m = {};
  let nextId = 35;

  function init() {
    m = {};
    entries.forEach((e) => {
      m[e.id] = e;
    });
    const maxNum = entries.reduce((max, e) => {
      const n = parseInt(e.id.replace('CAT-', ''), 10);
      return n >= max ? n + 1 : max;
    }, nextId);
    nextId = maxNum;
  }

  function all() {
    return Object.values(m).sort((a, b) => a.id.localeCompare(b.id));
  }

  function get(id) {
    return m[id] || null;
  }

  function store(entry) {
    const id = 'CAT-' + String(nextId++).padStart(4, '0');
    m[id] = { ...entry, id };
    return id;
  }

  function lookup(word) {
    const w = (word || '').toLowerCase().trim();
    const hw = (word || '').trim();
    return (
      Object.values(m).find(
        (e) =>
          (e.hebrew && e.hebrew === hw) ||
          (e.hebrew && e.hebrew.split('/').some((h) => h.trim() === hw)) ||
          (e.concept && e.concept.toLowerCase().split('/').some((c) => c.trim() === w)) ||
          (e.concept && e.concept.toLowerCase() === w) ||
          (e.concept && e.concept.toLowerCase().includes(w) && w.length > 3)
      ) || null
    );
  }

  init();

  root.MemoryEngineCatalog = { init, all, get, store, lookup };
})(typeof globalThis !== 'undefined' ? globalThis : window);
