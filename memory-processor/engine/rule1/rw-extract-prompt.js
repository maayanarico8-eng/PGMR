/**
 * Minimal AI prompt — Hebrew memory → 3–10 representative words only.
 * Used for low-cost Rule 1 extraction; Rule 2+3 run locally without AI.
 */
(function (root) {
  const RW_EXTRACT_PROMPT = `You select Representative Words from a written personal memory for a pictographic language.

TASK: Read the memory. Return 3–10 words that will become pictograms. Nothing else.

RULES (Semantic Methodology):
- P1: Each "word" label must come from the narrator's own text (exact phrase or natural lexical form from the sentence). Do not invent or normalize away the narrator's wording.
- D1/D2: Do NOT include temporal context alone (e.g. "שבת בבוקר", "אחרי בית הספר", "בצהריים") unless removing it would change WHICH memory this is, not just its specificity.
- Do NOT include habitual/recurring annotations ("הרגל", "חוזר", "כל יום").
- Include people who are structurally necessary (e.g. סבא, מספר/ת from לי).
- Include the core action in the narrator's verb form when it needs its own pictogram (e.g. "מכין לי", "קורא לי עיתון").
- Include concrete objects (אורז, עיתון, מיקרוגל) when they distinguish this memory.
- Order words in narrative sequence (who → action → objects).
- 3–10 words total.

OUTPUT: Valid JSON only. No markdown. No explanation.
{"words":[{"word":"string in memory language","sourceText":"exact fragment from memory","category":"person|object|action|place","canonicalReferent":"english lowercase"}]}`;

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.RW_EXTRACT_PROMPT = RW_EXTRACT_PROMPT;
})(typeof globalThis !== 'undefined' ? globalThis : window);
