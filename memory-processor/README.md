# Pictographic Memory Language — Processor

A validation-first processor that transforms written personal memories (primarily Hebrew) into pictographic sequences, governed by a formal visual language and semantic methodology.

This is a graduation project in Visual Communication. It does not aim to reconstruct objective memory — it investigates how memories can be translated into a consistent visual grammar, and how different relationships to a memory can produce different visual representations of it.

## What's in this repo

```
```
vercel.json                  ← Vercel rewrite: / → memory_processor.html
memory_processor.html      ← the entire processor (single-file, no build step)
docs/                       ← governing methodology documents
  Project_Vision.txt
  Constitution.txt
  Role.txt
  Working_Methodology.txt
  Semantic_Methodology.txt
  Illustration_Philosophy.txt
  Illustration_Grammar.txt
  Workflow_Grammar.txt
  Pictogram_Catalog_Specification.txt
```

## Running the processor

Open `memory_processor.html` in a browser. No installation, no build step, no server.

### Production deployment (Phase 1)

**URL:** [https://pgmr-two.vercel.app](https://pgmr-two.vercel.app)

The live deployment runs **Mock mode only**. The built-in example memory is pre-filled; click **Analyze memory** to run the full validation UI (Rule 1 output, Visual Representation Plan, pictogram catalog) without any API calls.

Real mode (Anthropic API) is not enabled in production yet — it requires a server-side API proxy in a later phase.

To redeploy after pushing to `main`, run from the repo root:

```bash
vercel --prod
```

### Transfer to Maayan's Vercel account

The project is currently deployed under a temporary Vercel account pending Maayan's signup. To move ownership:

1. Create a Vercel account at [vercel.com/signup](https://vercel.com/signup) using Maayan's email
2. Connect the GitHub account `maayanarico8-eng` when prompted
3. **Add New → Project** → Import `maayanarico8-eng/PGMR`
4. Framework Preset: **Other** — leave Build Command and Output Directory empty
5. Deploy; Vercel will pick up [`vercel.json`](../vercel.json) automatically
6. Optionally add collaborators as Team Members for shared access

The processor has two modes:

- **Mock mode** — runs a pre-scripted analysis on a built-in example memory. No API access required. Useful for testing the interface and the pictogram library connection without burning API calls.
- **Real mode** — runs the full pipeline (semantic analysis → visual representation planning → pictogram library lookup) on any memory you type, via the Anthropic API.

In Real mode, the processor:
1. Parses the written memory into semantic fields, applies the Memory Identity Gate (D1/D2), and selects Representative Words (Rule 1)
2. Plans how each Representative Word should be visually expressed — independent pictogram, contextual (sequence-based), or both (Rule 2)
3. Looks up each independently-represented word against the real pictogram library. A match renders the pictogram and logs `CATALOG_HIT`. No match logs `VISUAL_GAP` — the gap is surfaced, not hidden or invented (Rule 3)
4. For `VISUAL_GAP` cases, a reference SVG (e.g. from an icon library) can be uploaded; the processor reconstructs it according to the Illustration Grammar rather than reproducing it directly — a separate "Visual Representation Plan" step, not a fallback.

## Methodology

The processor is governed by the documents in `docs/`. They are the authoritative source of truth — methodology changes are made there first, then propagated to the processor's prompts and validation logic. If you find a case where the processor's behavior conflicts with a governing document, that's a validation finding, not an implementation detail to quietly patch.

Three documents matter most for understanding *why* the processor behaves as it does:

- **Semantic_Methodology.txt** — defines Memory Identity, the Constituent/Detail distinction, and the rules for selecting Representative Words. Includes **P1 Clarification — Lexical Form Fidelity**: the word label for each Representative Word must come from the narrator's own written words, not a normalized or restructured form.
- **Illustration_Grammar.txt** — the formal visual construction rules (stroke-based geometry, fixed primitive vocabulary, canonical frontal viewpoint).
- **Workflow_Grammar.txt** — the full four-rule pipeline (semantic analysis → visual representation planning → pictogram realization → memory packaging).

## Pictogram library

The catalog embedded in the processor is the project's actual hand-designed pictogram library — not placeholder icons. Each entry has a Catalog ID, a concept label, and (where applicable) a provisional flag noting that the label or visual form still needs confirmation against the original design.

## Status

Active validation phase. The processor is a research tool for surfacing methodology gaps — cases where the semantic analysis or visual planning diverges from what the governing documents specify — not a finished production tool.
