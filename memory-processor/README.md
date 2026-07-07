# Pictographic Memory Language — Processor

A validation-first processor that transforms written personal memories (primarily Hebrew) into pictographic sequences, governed by a formal visual language and semantic methodology.

This is a graduation project in Visual Communication. It does not aim to reconstruct objective memory — it investigates how memories can be translated into a consistent visual grammar, and how different relationships to a memory can produce different visual representations of it.

## What's in this repo

```
vercel.json                  ← Vercel rewrite: / → memory_processor.html
api/anthropic.js             ← server-side Anthropic proxy (uses ANTHROPIC_API_KEY)
api/streamline.js            ← server-side Streamline proxy (uses STREAMLINE_API_KEY)
api/streamline-mapping.js    ← local-dev writes to pictograms/streamline-mapping.json
engine/                      ← local Rule 1 + Rule 2 + Rule 3 + pipeline
  logger.js                    ← structured smart logging
  pipeline.js                  ← full Rule 1→2→3 orchestrator
  run.js                       ← CLI for chat tuning loop
  catalog/                     ← shared pictogram library
    translate-words.js           ← Hebrew → English batch translation for pictogram search
  anthropic-client.js          ← claude-sonnet-5 client, 429 backoff, JSON parse
  rule1/                       ← PROMPT_R1 decision-tree pipeline
    prompt-r1.js                 ← verb decision tree prompt (verbatim)
    semantic-analysis-pipeline.js ← guard, validate, retry, assignSequence
    rw-extract-prompt.js         ← legacy minimal prompt (unused in API modes)
    build-from-words.js          ← legacy AI words adapter
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
2. Add `STREAMLINE_API_KEY` from [streamlinehq.com/profile?tab=api_keys](https://www.streamlinehq.com/profile?tab=api_keys) for pictogram fetch
3. Redeploy (or run `vercel --prod` from the repo root)


### Pictogram mapping (live on production)

English → Streamline icon mappings are stored in a single JSON file via **Vercel Blob** (not a database).

1. Vercel dashboard → **Storage** → **Blob** → create store and link to this project
2. Vercel auto-adds `BLOB_READ_WRITE_TOKEN`
3. New words are saved live via `POST /api/streamline-mapping` — no git commit per word

Without Blob configured, mapping falls back to the repo file `memory-processor/pictograms/streamline-mapping.json` (local dev only).

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

The processor has six modes (Settings → Processor Mode):

- **Bank test** — pick a sample sentence; translates Hebrew words to English, then resolves pictograms via `streamline-mapping.json` → Streamline HQ. Missing words show ✕.
- **AI Words** — one Anthropic call (`claude-sonnet-5`, PROMPT_R1 verb decision tree, max 20 words). Validation + one retry; sequence order computed in code. **VRP, catalog lookup run locally.**
- **Local** — deterministic rules only (`engine/`). Zero API. Best for curated memories and rule tuning.
- **Mock** — pre-scripted analysis on the built-in example memory. No API.
- **Hybrid** — local Rule 1 when supported; otherwise falls back to **AI Words** (not full API).
- **Full API** — PROMPT_R1 Rule 1 → Representative Words (Hebrew + English, verb→noun) → Streamline pictogram preview via `claude-sonnet-5`.

**Bank test / AI Words / Hybrid / Full API** require `ANTHROPIC_API_KEY` on Vercel for translation and/or semantic analysis. All Anthropic calls use `claude-sonnet-5`.


Run translate-words tests:

```bash
node memory-processor/engine/catalog/translate-words.test.js
```

Run PROCESSOR_SPEC pipeline tests:

```bash
node memory-processor/engine/rule1/semantic-analysis-pipeline.test.js
```

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
1. Calls Anthropic with PROMPT_R1 to extract Representative Words (Rule 1)
2. Translates each word to English for pictogram search (verb→noun rule for actions)
3. On **Preview pictograms**, resolves icons via `streamline-mapping.json` → Streamline HQ family search (`core-line-free`). Gaps can be filled by uploading a reference SVG for Rule 3 auto-realization.

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
