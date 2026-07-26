# Archive behavior — general rules

Apply these to every memory. Do not re-ask; do not improvise.

Frame is 1920×1080. Shared right edge for ×, source, output, and sequence ink: **1381.81**.

---

## OUTPUT & ICON — place 1:1

`output.svg` and `icon.svg` are exported from Figma at the **exact size** they should appear on screen (the same size as in the card).

**Place them 1:1. Nothing else.**

- Read the file’s `width` and `height` attributes and place at that size (in frame units via `--figma-unit`).
- **No** scale factor, **no** transform, **no** ink-based resizing, **no** fitting to a box, **no** stroke adjustment.
- If a file is the wrong size, that is fixed in Figma — not in code.
- If `width` / `height` are missing, **stop and report** — do not invent a size from `viewBox` or another memory.

Icon: only **vertical position** (`iconTop`) varies per memory; size is whatever the file says.

Output: position with right edge on **1381.81**; top as laid out for the card. Size is whatever the file says.

## ASSETS

- **SVG only**, placed as delivered.
- If a **PNG** arrives, **stop and tell the user** — do not use it, do not convert it, do not substitute another file.

## TEXTS

- Real text in the project fonts, taken from that memory’s SVG.
- No outlined/path text, no images of text, no invented copy.

## IF SOMETHING IS MISSING

- **Stop and ask.**
- Do not improvise a value.
- Do not copy it from another memory.
- Do not leave a placeholder.
