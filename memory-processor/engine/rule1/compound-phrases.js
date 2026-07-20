/**
 * Multi-word RW labels: trust Anthropic for lexicalized compounds.
 * Code only collapses clearly forbidden grammatical multi-word patterns.
 */
(function (root) {
  function normalizePhrase(phrase) {
    return (phrase || '').trim().replace(/\s+/g, ' ');
  }

  /** Auxiliaries / temporal-clause openers — never keep with a following verb. */
  const FORBIDDEN_FIRST = new Set([
    'היה', 'הייתה', 'היתה', 'היו', 'הייתי', 'היינו', 'היית', 'הייתם', 'הייתן',
    'כש', 'כאשר', 'כשהייתי', 'כשהיינו', 'כשהיית', 'כשהיה', 'כשהייתה',
  ]);

  /** Second-token clitics / particles — verb+clitic is not a compound name. */
  const FORBIDDEN_SECOND = new Set([
    'לי', 'לך', 'לו', 'לה', 'לנו', 'לכם', 'להם',
    'אותי', 'אותך', 'אותו', 'אותה', 'אותנו',
    'על', 'את', 'עם', 'אל',
    'ואני', 'ואתה', 'ואת', 'ואנחנו', 'והוא', 'והיא',
  ]);

  const TIME_SECONDS = new Set(['בוקר', 'צהריים', 'ערב', 'לילה', 'בבוקר', 'בצהריים', 'בערב']);

  function stripPrefix(token) {
    const t = (token || '').trim();
    for (const pre of ['ו', 'ה', 'ב', 'ל', 'מ', 'כ', 'ש']) {
      if (t.startsWith(pre) && t.length > pre.length + 1) return t.slice(pre.length);
    }
    return t;
  }

  /**
   * Structural rejects only — not an allowlist.
   * Lexicalized compounds (בית ספר, מזג אוויר, …) are decided by the model prompt.
   */
  function isForbiddenMultiWordLabel(phrase) {
    const norm = normalizePhrase(phrase);
    if (!norm || !/\s/.test(norm)) return false;
    const parts = norm.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    if (parts.length > 3) return true;

    const first = parts[0];
    const second = parts[1];
    const firstCore = stripPrefix(first);
    const secondCore = stripPrefix(second);

    if (FORBIDDEN_FIRST.has(first) || FORBIDDEN_FIRST.has(firstCore)) return true;
    if (FORBIDDEN_SECOND.has(second) || FORBIDDEN_SECOND.has(secondCore)) return true;
    if (parts.some((p) => /\d/.test(p)) && parts.some((p) => TIME_SECONDS.has(stripPrefix(p)) || TIME_SECONDS.has(p))) {
      return true;
    }
    // Person + vav-person: אמא ואני (second token starts with ו + pronoun)
    if (/^ו(אני|אתה|את|אנחנו|הוא|היא)$/.test(second)) return true;
    return false;
  }

  /** Keep 2–3 token labels unless they match a forbidden grammatical pattern. */
  function isAllowedCompoundPhrase(phrase) {
    const norm = normalizePhrase(phrase);
    if (!norm || !/\s/.test(norm)) return false;
    const parts = norm.split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 3) return false;
    return !isForbiddenMultiWordLabel(norm);
  }

  function collapseToSingleToken(word, category) {
    const trimmed = normalizePhrase(word);
    if (!trimmed) return '';
    if (!/\s/.test(trimmed)) return trimmed;
    if (isAllowedCompoundPhrase(trimmed)) return trimmed;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const numeric = parts.find((p) => /\d/.test(p));
    if (numeric) return numeric;
    const cat = (category || '').toLowerCase();
    if (cat === 'action' || cat === 'participant' || cat === 'person') return parts[0];
    return parts[parts.length - 1];
  }

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.isForbiddenMultiWordLabel = isForbiddenMultiWordLabel;
  root.MemoryEngineRule1.isAllowedCompoundPhrase = isAllowedCompoundPhrase;
  root.MemoryEngineRule1.normalizeCompoundPhrase = normalizePhrase;
  root.MemoryEngineRule1.collapseToSingleToken = collapseToSingleToken;
})(typeof globalThis !== 'undefined' ? globalThis : window);
