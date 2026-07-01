# Pictographic Memory Language — Processor

A validation-first processor that transforms written personal memories (primarily Hebrew) into pictographic sequences, governed by a formal visual language and semantic methodology.

This is a graduation project in Visual Communication. It does not aim to reconstruct objective memory — it investigates how memories can be translated into a consistent visual grammar, and how different relationships to a memory can produce different visual representations of it.

## What's in this repo

```
vercel.json                  ← Vercel rewrite: / → memory_processor.html
api/anthropic.js             ← server-side Anthropic proxy (uses ANTHROPIC_API_KEY)
engine/                      ← local Rule 1 + Rule 2 + Rule 3 + pipeline
  logger.js                    ← structured smart logging
  pipeline.js                  ← full Rule 1→2→3 orchestrator
  run.js                       ← CLI for chat tuning loop
  catalog/                     ← shared pictogram library
  rule1/                       ← extract + stages 1.3–1.7 + minimal AI adapter
    rw-extract-prompt.js         ← small prompt: sentence → 3–10 words
    build-from-words.js          ← AI words → Rule 1 shape for local Rule 2+3
  rule2/vrp.js                 ← VRP heuristics + Test V patterns
  rule3/lookup.js              ← catalog lookup (CATALOG_HIT / VISUAL_GAP)
.env.example                 ← local env template
memory_processor.html        ← the entire processor (single-file, no build step)
docs/                        ← governing methodology documents
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

The built-in example memory is pre-filled in Mock mode; click **Analyze memory** to run the full validation UI without API calls.

**Real mode** calls Anthropic through a server-side proxy (`/api/anthropic`). Set the API key once as a Vercel environment variable:

1. Vercel dashboard → **Project → Settings → Environment Variables**
2. Add `ANTHROPIC_API_KEY` with your Anthropic key (`sk-ant-...`)
3. Redeploy (or run `vercel --prod` from the repo root)

For local Real mode testing, copy `.env.example` to `.env.local`, add your key, and run `vercel dev` from the repo root (opening the HTML file directly will not reach the API proxy).

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

The processor has five modes (Settings → Processor Mode):

- **AI Words** (default) — one small Anthropic call: Hebrew sentence → 3–10 representative words (~600 tokens). **VRP, catalog lookup, and sequence run locally** — no further API cost or wait.
- **Local** — deterministic rules only (`engine/`). Zero API. Best for curated memories and rule tuning.
- **Mock** — pre-scripted analysis on the built-in example memory. No API.
- **Hybrid** — local Rule 1 when supported; otherwise falls back to **AI Words** (not full API).
- **Full API** — legacy full Rule 1 + VRP + ARA via Anthropic (highest cost).

**AI Words mode** requires `ANTHROPIC_API_KEY` on Vercel (see below). Only the word-selection step uses the API; pictogram planning and library lookup are free and instant.

Run Rule 1 golden test:

```bash
node memory-processor/engine/rule1/test.js
```

Run full local pipeline (chat tuning loop):

```bash
node memory-processor/engine/run.js "בשבת בבוקר, סבא היה קורא לי עיתון ושרנו ביחד."
node memory-processor/engine/pipeline.test.js
```

**Full API mode** requires `ANTHROPIC_API_KEY` on Vercel (see below).
In **AI Words / Hybrid** mode, the processor:
1. Calls Anthropic once with a minimal prompt to select 3–10 representative words (Rule 1 extract only)
2. Plans visual mode per word locally — independent / contextual / gap (Rule 2)
3. Looks up pictograms in the catalog locally (Rule 3)

In **Full API** mode, the processor:
1. Parses the written memory into semantic fields, applies the Memory Identity Gate (D1/D2), and selects Representative Words (Rule 1)
2. Plans how each Representative Word should be visually expressed — independent pictogram, contextual (sequence-based), or both (Rule 2)
3. Looks up each independently-represented word against the real pictogram library. A match renders the pictogram and logs `CATALOG_HIT`. No match logs `VISUAL_GAP` — the gap is surfaced, not hidden or invented (Rule 3)
4. For `VISUAL_GAP` cases in **Anthropic** mode, a reference SVG can be uploaded for automatic Rule 3 realization. In **Local/Hybrid** mode, gaps remain for manual designer workflow.

The Visual Representation Plan may list more units than Library Lookup processes. Units classified as **Contextual** in Rule 2 remain in the plan but are intentionally excluded from catalog lookup because their meaning is expressed through other pictograms in the sequence.

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
