/**
 * Minimal AI prompt — Hebrew memory → 3–10 representative words only.
 * Used for low-cost Rule 1 extraction; Rule 2+3 run locally without AI.
 */
(function (root) {
  const RW_EXTRACT_PROMPT = `You select Representative Words from a written personal memory for a pictographic language.

TASK: Read the memory. Return 3–10 words that will become pictograms. Nothing else.

RULES (Semantic Methodology):
- P1: Each "word" label must be an exact single token from the narrator's own text. Do not invent wording.
- SINGLE-TOKEN RULE (HARD): "word" MUST be one whitespace-separated token — NEVER multi-word labels. FORBIDDEN: "7 בבוקר", "שיעור ספרדית", "מכין לי", "בית ספר". From a multi-word phrase pick only the most pictogram-critical token (ב7 בבוקר→ב7 or 7; שיעור ספרדית→ספרדית; מכין לי→מכין).
- D1/D2: Do NOT include temporal context alone (e.g. "שבת בבוקר", "אחרי בית הספר", "בצהריים") unless removing it would change WHICH memory this is, not just its specificity — and if included, still ONE token only.
- Do NOT include habitual/recurring annotations ("הרגל", "חוזר", "כל יום").
- Include people who are structurally necessary (e.g. סבא, מספר/ת from לי).
- Include the core action as a single verb token when it needs its own pictogram (e.g. "מכין", "קורא").
- Include concrete objects (אורז, עיתון, מיקרוגל) when they distinguish this memory.
- Order words in narrative sequence (who → action → objects).
- 3–10 words total.

- canonicalReferent: English lowercase pictogram search term disambiguated for icon lookup using THIS memory's context — not a generic dictionary gloss. Prefer visually specific terms when libraries confuse short words (בריכה in swimming context → swimming pool, not pool; נסענו on a car trip without named vehicle → drive or car, not travel; נסענו באוטובוס → bus). For verbs/actions use a pictogram noun (שרו→song, ראה→see) — never conjugated verbs or clauses. Bank normalization (visible "word" stays as written): weekday → day; country name → country; language name → language; clock time → hour (morning/evening stay as-is); male kinship/partner → boy except dad→father and grandpa→grandfather; female kinship/partner → girl except mom→mother and grandma→grandmother.

OUTPUT: Valid JSON only. No markdown. No explanation.
{"words":[{"word":"single token from memory (no spaces)","sourceText":"exact fragment from memory","category":"person|object|action|place","canonicalReferent":"english lowercase"}]}`;

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.RW_EXTRACT_PROMPT = RW_EXTRACT_PROMPT;
})(typeof globalThis !== 'undefined' ? globalThis : window);
