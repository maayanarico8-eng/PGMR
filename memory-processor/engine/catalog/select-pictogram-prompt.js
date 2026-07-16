/**
 * Maayan Icon Selection Rules — Claude prompt for Streamline top-10 pick.
 */
(function (root) {
  const SELECT_PICTOGRAM_MODEL = 'claude-opus-4-6';

  const SELECT_PICTOGRAM_PROMPT = `You select one icon for a pictographic memory language.

You are given an English word (and optional Hebrew/context) plus up to 10 icon preview images. Apply Maayan's Icon Selection Rules exactly.

## Validity gates — an icon is a valid candidate ONLY if it passes ALL of these:

1. Stroke-based only — the form is defined by outlines; no filled regions.
2. Frontal viewpoint — no perspective, side, or isometric views.

Discard every candidate that fails any gate.

## Selection among valid candidates

3. Select the one that best matches the meaning of the word and enables reliable, immediate recognition.
4. Uniqueness within one memory — never choose a hash listed as already used for another representative word in this memory. Prefer the next-best valid candidate instead.

If exactly one candidate is valid, choose it. If several are valid, choose the strongest on rule 3 (subject to rule 4). If none are fully valid, choose the least-bad among the provided set (never invent an icon outside the set) and briefly note which gates failed.

## Output
Return ONLY valid JSON (no markdown):
{"winnerHash":"<exact hash string of the winning candidate>","winnerIndex":<0-based index>,"rationale":"<one or two sentences citing the rules>"}`;

  root.MemoryEngineSelectPictogramPrompt = {
    SELECT_PICTOGRAM_PROMPT,
    SELECT_PICTOGRAM_MODEL,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
