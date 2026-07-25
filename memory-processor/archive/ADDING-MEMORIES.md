# Adding archived memories (Figma frame exports)

Use this when wiring the next archive memory (004, 005, … ~70). No hand-laid detail HTML/CSS per memory — each memory is **Figma exports + a small data entry**.

Live site: https://pgmr-two.vercel.app  
Local: `npm run dev` → http://localhost:3000 — lock viewport **1920×1080** for 1:1 checks.

Reference examples already live: **001**, **002**, **003** (all use SVG detail frames + a cropped `preview.png` from Hover a Memory).

---

## Concept

| State | What the user sees | Asset |
|--------|-------------------|--------|
| List hover | HTML list + pictogram + % params (not a full-page export) | Crop `previewPictogram` from **Hover a Memory** + `frequency` / `clarity` / `impact` |
| Detail idle | Full 1920×1080 frame | `frames.default` |
| Detail text hover | Same frame with representative words + pictogram bank strip (**no chevron**, no bank toggle) | `frames.hover` |

There is **no** separate “pictogram bank open” screen. Do not export or wire a bank-toggle state.

Transparent hit overlays (nav, archive/generator links, text-hover zone) live once in `memory_processor.html`. You normally **do not** change them when adding a memory.

---

## 1. Export from Figma

From the archive frames for that memory (1920×1080), export **all three**:

| Figma / export name (typical) | Used for | Save as |
|-------------------------------|----------|---------|
| **Hover a Memory** | List-row hover — source for pictogram crop + read the three % values | keep for cropping (do not ship the full frame) |
| **Click on Memory** | Detail idle | `detail-default.png` or `.svg` |
| **Pictograms** (frame with Memory text-hover) | Detail text hover — representative words + pictogram bank + source info | `detail-hover.png` or `.svg` (prefer PNG if SVG export drops nested pictograms) |

From **Hover a Memory**, also note:

1. The list-hover pictogram on the right (crop only that graphic).
2. The three percentages shown with the params:
   - תדירות הזיכרון → `frequency`
   - בהירות הזיכרון → `clarity`
   - השפעת הזיכרון → `impact`

PNG or SVG both work for detail frames (`<img src>`). Prefer whatever Figma exports cleanly at 1920×1080.

### Preview pictogram crop + permanent Y

On every **Hover a Memory** frame the icon is **Group 48**:

| | Figma (1920×1080) |
|--|-------------------|
| Axis | Extreme right — `x ≈ 1629.71`, `w:207.22`, `h:194.11` |
| Varies per memory | **Y only** (`Group 48.y`) → store as `previewFigmaTop` |
| Parameters | Always `x:1586.99` `y:810` `w:251` `h:121` — fixed in CSS, not per memory |

Save the crop as `preview.png` or `preview.svg` (white/`#FCFCFC` background). Do **not** commit the full Hover a Memory frame into `assets/archive/NNN/`.

**Never invent Y.** Extract `previewFigmaTop` from that memory’s Hover a Memory Figma link. If a ready memory is missing it, stop and ask — no fallback / random / computed position.

---

## 2. Drop files in the repo

```text
memory-processor/assets/archive/NNN/
  detail-default.png   # or .svg  ← Click on Memory (open card)
  detail-hover.png     # or .svg  ← Pictograms (hover the memory text)
  preview.png          # crop from Hover a Memory (required for list hover UI)
```

`NNN` is zero-padded: `004`, `005`, …

Example for 003:

```text
memory-processor/assets/archive/003/detail-default.svg
memory-processor/assets/archive/003/detail-hover.svg
memory-processor/assets/archive/003/preview.png
```

---

## 3. Wire the catalog

Edit only:

`memory-processor/archive/archived-memories.js`

1. The list **title** for that index should already be in the `titles` array (index `0` → `001`, `1` → `002`, …).
2. Add (or extend) an entry in the `extra` map:

```js
'004': {
  frequency: 78,          // from Hover a Memory — תדירות הזיכרון
  clarity: 83,            // בהירות הזיכרון
  impact: 24,             // השפעת הזיכרון
  previewPictogram: '/memory-processor/assets/archive/004/preview.png',
  previewFigmaTop: 120.31, // Group 48.y from THIS memory’s Hover a Memory frame — required
  ready: true,             // required — row becomes clickable
  frames: {
    default: '/memory-processor/assets/archive/004/detail-default.svg',
    hover: '/memory-processor/assets/archive/004/detail-hover.svg',
  },
},
```

Rules:

- `ready: true` **and** `frames.default` are required for click → detail.
- `frames.hover` is required for text-hover swap.
- List hover needs `previewPictogram`, `previewFigmaTop`, **and** the three % fields.
- `previewFigmaTop` — permanent absolute Y of Group 48 on that memory’s Hover a Memory frame. Same every session.
- Parameters % text always renders at the shared CSS position (Figma y:810) — do not store a per-memory params position.
- Paths are site-root absolute (`/memory-processor/assets/...`).
- Do **not** add layout HTML/CSS for the detail content of that memory.
- Do **not** add a `frames.bank` field (removed from the product).
- Do **not** ship the full **Hover a Memory** frame as a detail asset — HTML builds the list; only the pictogram crop + % numbers + Y are used.
- Do **not** use `previewPlacement` (removed).

---

## 4. QA checklist (1920×1080)

1. Open **ארכיון** — new title appears in the list (from `titles`).
2. Hover the row — pictogram appears in the correct Figma slot + % params match the export.
3. Click the row — full `detail-default` fills the viewport (pixel-match Figma).
4. Hover the memory text area — swaps to `detail-hover` (rep words + pictogram strip, no chevron).
5. Mouse leave text — back to `detail-default`.
6. Bottom `<` / `>` shuffle among memories that have `frames` (001, 002, 003, …).
7. Header hits: **ארכיון** → list, **מחולל זיכרונות** → generator.

---

## 5. Ship

```bash
# from repo root — only the new assets + archived-memories.js
# (include memory_processor.html only if hover layout behavior changed)
git add memory-processor/archive/archived-memories.js memory-processor/assets/archive/NNN/
git commit -m "Add archive memory NNN via Figma frame exports."
git push origin main
vercel --prod --yes
```

Production alias: https://pgmr-two.vercel.app

---

## What not to do

- Rebuild detail layout in HTML/CSS to “match Figma” — export the frame instead.
- Skip **Hover a Memory** — without the crop + %, list hover is incomplete.
- Commit the full Hover a Memory 1920×1080 frame into `assets/archive/NNN/` (unused by the app).
- Add a bank open/close interaction or `detail-bank` asset.
- Commit leftover unused SVGs from old experiments (`bank/`, chevrons, etc.) unless something still references them.
- Change shared hit-overlay CSS unless a new memory’s text block is clearly outside the shared zone (`.archive-hit-body` in `memory_processor.html`). Prefer keeping one shared zone.

---

## File map (for agents / other chats)

| File | Role |
|------|------|
| `memory-processor/archive/archived-memories.js` | Titles + per-memory `ready` / `frames` / list preview params |
| `memory-processor/assets/archive/NNN/*` | Figma exports for that memory (`detail-*` + `preview`) |
| `memory-processor/memory_processor.html` | List UI + detail shell (one `<img>` + hit overlays) — rarely edit when adding memories |
| This doc | Workflow for Maayan / other chats with no prior context |
