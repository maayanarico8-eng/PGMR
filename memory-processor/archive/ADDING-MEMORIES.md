# Adding archived memories (Figma frame exports)

Use this when wiring the next archive memory (003, 004, … ~70). No hand-laid detail HTML/CSS per memory — each memory is **Figma exports + a small data entry**.

Live site: https://pgmr-two.vercel.app  
Local: `npm run dev` → http://localhost:3000 — lock viewport **1920×1080** for 1:1 checks.

Reference examples already live: **001**, **002**.

---

## Concept

| State | What the user sees | Asset |
|--------|-------------------|--------|
| List hover | HTML list + pictogram + % params (not a full-page export) | `previewPictogram` (optional crop) |
| Detail idle | Full 1920×1080 frame | `frames.default` |
| Detail text hover | Same frame with representative words + pictogram bank strip (**no chevron**, no bank toggle) | `frames.hover` |

There is **no** separate “pictogram bank open” screen. Do not export or wire a bank-toggle state.

Transparent hit overlays (nav, archive/generator links, text-hover zone) live once in `memory_processor.html`. You normally **do not** change them when adding a memory.

---

## 1. Export from Figma

From the archive detail frames for that memory (1920×1080), export:

| Figma / export name (typical) | Save as |
|-------------------------------|---------|
| Click / idle detail | `detail-default.png` or `.svg` |
| Hover memory text (representative words) | `detail-hover.png` or `.svg` |

Optional for list hover: a pictogram crop (or reuse an existing preview asset) → `preview.png` / `preview.svg`.

PNG or SVG both work (`<img src>`). Prefer whatever Figma exports cleanly at 1920×1080.

---

## 2. Drop files in the repo

```text
memory-processor/assets/archive/NNN/
  detail-default.png   # or .svg
  detail-hover.png     # or .svg
  preview.png          # optional — list hover pictogram
```

`NNN` is zero-padded: `003`, `004`, …

Example for 002:

```text
memory-processor/assets/archive/002/detail-default.svg
memory-processor/assets/archive/002/detail-hover.svg
memory-processor/assets/archive/002/preview.png
```

---

## 3. Wire the catalog

Edit only:

`memory-processor/archive/archived-memories.js`

1. The list **title** for that index should already be in the `titles` array (index `0` → `001`, `1` → `002`, …).
2. Add (or extend) an entry in the `extra` map:

```js
'003': {
  frequency: 12,          // % shown on list hover
  clarity: 40,
  impact: 55,
  previewPictogram: '/memory-processor/assets/archive/003/preview.png', // optional
  ready: true,            // required — row becomes clickable
  frames: {
    default: '/memory-processor/assets/archive/003/detail-default.png',
    hover: '/memory-processor/assets/archive/003/detail-hover.png',
  },
},
```

Rules:

- `ready: true` **and** `frames.default` are required for click → detail.
- `frames.hover` is required for text-hover swap.
- Paths are site-root absolute (`/memory-processor/assets/...`).
- Do **not** add layout HTML/CSS for the detail content of that memory.
- Do **not** add a `frames.bank` field (removed from the product).

---

## 4. QA checklist (1920×1080)

1. Open **ארכיון** — new title appears in the list (from `titles`).
2. Hover the row — if `previewPictogram` is set, pictogram + % params show.
3. Click the row — full `detail-default` fills the viewport (pixel-match Figma).
4. Hover the memory text area — swaps to `detail-hover` (rep words + pictogram strip, no chevron).
5. Mouse leave text — back to `detail-default`.
6. Bottom `<` / `>` shuffle among memories that have `frames` (001, 002, …).
7. Header hits: **ארכיון** → list, **מחולל זיכרונות** → generator.

---

## 5. Ship

```bash
# from repo root — only the new assets + archived-memories.js
git add memory-processor/archive/archived-memories.js memory-processor/assets/archive/NNN/
git commit -m "Add archive memory NNN via Figma frame exports."
git push origin main
vercel --prod --yes
```

Production alias: https://pgmr-two.vercel.app

---

## What not to do

- Rebuild detail layout in HTML/CSS to “match Figma” — export the frame instead.
- Add a bank open/close interaction or `detail-bank` asset.
- Commit leftover unused SVGs from old experiments (`bank/`, chevrons, etc.) unless something still references them.
- Change shared hit-overlay CSS unless a new memory’s text block is clearly outside the shared zone (`.archive-hit-body` in `memory_processor.html`). Prefer keeping one shared zone.

---

## File map (for agents / other chats)

| File | Role |
|------|------|
| `memory-processor/archive/archived-memories.js` | Titles + per-memory `ready` / `frames` / list preview params |
| `memory-processor/assets/archive/NNN/*` | Figma exports for that memory |
| `memory-processor/memory_processor.html` | List UI + detail shell (one `<img>` + hit overlays) — rarely edit when adding memories |
| This doc | Workflow for Maayan / other chats with no prior context |
