/**
 * Minimal AI prompt — Hebrew memory → 3–10 representative words only.
 * Used for low-cost Rule 1 extraction; Rule 2+3 run locally without AI.
 */
(function (root) {
  const RW_EXTRACT_PROMPT = `You select Representative Words from a written personal memory for a pictographic language.

TASK: Read the memory. Return 3–10 words that will become pictograms. Nothing else.

RULES (Semantic Methodology):
- P1: Each "word" label must be an exact fragment from the narrator's own text. Do not invent wording.
- COMPOUND TEST (apply to every multi-token candidate): Keep TWO tokens as one Representative Word ONLY when they name a single lexicalized concept — one place, institution, or object that speakers treat as one unit (Hebrew smichut / fixed compound). Decision question: "Would this appear as one dictionary entry, one sign, or one pictogram concept?" If yes → keep both tokens together. If the tokens are only linked by grammar → pick ONE token.
  KEEP (one concept / name): בית חולים, בית ספר, גן ילדים, חדר אוכל, חדר כושר, כרטיס אשראי, מזג אוויר, יום הולדת, שיעורי בית, and similar noun–noun compounds in the text.
  SPLIT / take one token (grammar, not a name): verb phrases (כשהייתי הולך, היה מצייר, קופץ על), people joined by ו (אמא ואני → אמא and אני as separate words if both needed), noun+adjective (בית יפה, עוגה טעימה), verb+destination (הלכנו לקולנוע → הלכנו or קולנוע), clock/time (7 בבוקר → 7 or בוקר), lesson+subject (שיעור ספרדית → ספרדית), verb+recipient (מכין לי → מכין; לי separately if narrator-participant).
- D1/D2: Do NOT include temporal context alone (e.g. "שבת בבוקר", "אחרי בית הספר", "בצהריים") unless removing it would change WHICH memory this is, not just its specificity — and if included, still ONE token only (not a multi-word time phrase).
- Do NOT include habitual/recurring annotations ("הרגל", "חוזר", "כל יום").
- PARTICIPANTS (HARD): Include every person who participates in the remembered event when they appear as a token in the text (e.g. סבא, אחותי, אמא). Skipping a named co-participant is forbidden.
- NARRATOR-AS-PARTICIPANT (HARD): When the narrator is explicitly named as a participant (אני / לי / אותי / אלי), that exact token MUST be a Representative Word. Do NOT substitute conjugated narrator forms (היינו, הייתי, היית) for the participant pronoun when the pronoun is present — prefer אני over היינו when both appear (e.g. "אחותי ואני היינו…" → include אחותי and אני, not היינו).
- Include the core action as a single verb token when it needs its own pictogram (e.g. "מכין", "קורא", "הולכות").
- Include concrete objects (אורז, עיתון, מיקרוגל) when they distinguish this memory.
- Order words in narrative sequence (who → action → objects).
- 3–10 words total.

- canonicalReferent: English lowercase pictogram search term disambiguated for icon lookup using THIS memory's context — not a generic dictionary gloss. Prefer visually specific terms when libraries confuse short words (בריכה in swimming context → swimming pool, not pool; נסענו on a car trip without named vehicle → drive or car, not travel; נסענו באוטובוס → bus). For verbs/actions use a pictogram noun (שרו→song, ראה→see) — never conjugated verbs or clauses. Bank normalization (visible "word" stays as written): weekday → day; country name → country; language name → language; clock time → hour (morning/evening stay as-is); male kinship/partner → boy except dad→father and grandpa→grandfather; female kinship/partner → girl except mom→mother and grandma→grandmother.

OUTPUT: Valid JSON only. No markdown. No explanation.
{"words":[{"word":"token or lexicalized compound from memory","sourceText":"exact fragment from memory","category":"person|object|action|place","canonicalReferent":"english lowercase"}]}`;

  root.MemoryEngineRule1 = root.MemoryEngineRule1 || {};
  root.MemoryEngineRule1.RW_EXTRACT_PROMPT = RW_EXTRACT_PROMPT;
})(typeof globalThis !== 'undefined' ? globalThis : window);
