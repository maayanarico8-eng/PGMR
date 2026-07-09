/**
 * Maayan pictogram prompts — reference restyle (primary) + from-scratch fallback.
 */
(function (root) {
  const MAAYAN_GRAMMAR = `ILLUSTRATION GRAMMAR — STRICT:
# STYLE (code-enforced, absolute)
A1. Canvas 64×64, viewBox="0 0 64 64".
A2. Content scaled uniformly, longest side = 56px, centered.
A3. Scale baked into coordinates. No transform attributes.
A4. Single <path> element.
A5. stroke="#000000". A6. stroke-width="1.0". A7. stroke-linecap="round", stroke-linejoin="round".
A8. fill="none". No filled shapes. Dot = zero-length path with round cap; filled circle r<2px in source → convert to dot; any other fill → reject source.
A9. Corner fillets: radius 1.0px between straight segments; side too short → reduce radius to fit; organic/design curves never modified.
A10. Geometry: open or closed contours of line and arc segments only (M L A Z H V commands in path d).

The output must be immediately recognizable as the concept within the 64×64 space.
Represents the CATEGORY, not a specific instance. Frontal viewpoint only.`;

  const PICTOGRAM_REALIZE_PROMPT = `You are the Rule 3 Pictogram Realization processor for a pictographic visual language.

You receive a reference SVG from an external icon library and a concept label.
Your task: recreate the concept as a new pictogram that belongs to this specific visual language.

Use the reference ONLY to understand the concept's essential visual identity — do NOT copy its structure, paths, or style.
Restyle completely to match the grammar below.

${MAAYAN_GRAMMAR}

Return ONLY valid JSON — no markdown, no explanation:
{"svg":"<svg viewBox=\\"0 0 64 64\\" xmlns=\\"http://www.w3.org/2000/svg\\" fill=\\"none\\" stroke=\\"#000000\\" stroke-width=\\"1.0\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"...\\" fill=\\"none\\"/></svg>","geometricDescription":"..."}`;

  const PICTOGRAM_FALLBACK_PROMPT = `You are the Rule 3 Pictogram Realization processor for a pictographic visual language.

No reference SVG is available — the external icon library had no match.
Generate a new pictogram from the concept label alone, following the grammar below.

${MAAYAN_GRAMMAR}

Return ONLY valid JSON — no markdown, no explanation:
{"svg":"<svg viewBox=\\"0 0 64 64\\" xmlns=\\"http://www.w3.org/2000/svg\\" fill=\\"none\\" stroke=\\"#000000\\" stroke-width=\\"1.0\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"...\\" fill=\\"none\\"/></svg>","geometricDescription":"..."}`;

  const JSON_SYSTEM =
    'You output only valid JSON. No markdown. No code fences. No explanation. Your response must be parseable by JSON.parse().';

  root.MemoryEngineRule3 = root.MemoryEngineRule3 || {};
  root.MemoryEngineRule3.PICTOGRAM_REALIZE_PROMPT = PICTOGRAM_REALIZE_PROMPT;
  root.MemoryEngineRule3.PICTOGRAM_FALLBACK_PROMPT = PICTOGRAM_FALLBACK_PROMPT;
  root.MemoryEngineRule3.PICTOGRAM_JSON_SYSTEM = JSON_SYSTEM;
})(typeof globalThis !== 'undefined' ? globalThis : window);
