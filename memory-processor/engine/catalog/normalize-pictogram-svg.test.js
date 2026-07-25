/**
 * Pictogram SVG normalizer unit tests
 * Run: node memory-processor/engine/catalog/normalize-pictogram-svg.test.js
 */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const api = require('./normalize-pictogram-svg.js');

console.log('normalize-pictogram-svg tests…');

{
  assert(api.SIZE === 64, 'size constant 64');
  assert(api.STROKE_WIDTH === '0.25', 'stroke width 0.25');
  assert(api.STROKE_COLOR === '#000000', 'stroke color #000000');
  assert(api.BANK_HEIGHT === 48, 'bank height 48');
  assert(api.CONTENT_MAX === 42, 'content max 42');
  assert(api.MARGIN === 3, 'margin 3');
  assert(api.DISPLAY_HEIGHT_PX === 105, 'display height 105');
  assert(api.DISPLAY_GAP_PX === 0.875, 'display gap 0.875');
}

// Streamline-like inline attrs (legacy 64 path)
{
  const input =
    `<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M2 12h20" fill="#fff" stroke="#abc" stroke-width="2"/>` +
    `<circle cx="12" cy="12" r="4" style="fill:red;stroke:blue;stroke-width:3"/>` +
    `</svg>`;
  const out = api.normalizePictogramSvg(input);
  assert(/width="64"/.test(out) && /height="64"/.test(out), 'root size forced to 64');
  assert(/viewBox="0 0 24 24"/.test(out), 'preserves existing viewBox');
  assert(/stroke="#000000"/.test(out), 'path stroke #000000');
  assert(/stroke-width="0\.25"/.test(out), 'path stroke-width 0.25');
  assert(/fill="none"/.test(out), 'fill none on graphics');
  assert(/style="[^"]*stroke:#000000/.test(out), 'inline style stroke rewritten');
  assert(/style="[^"]*stroke-width:0\.25/.test(out), 'inline style stroke-width rewritten');
}

// Bank-like CSS class SVG (no stroke-width in stylesheet) — legacy path
{
  const input =
    `<svg id="Layer_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<defs><style>.cls-1{fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;}</style></defs>` +
    `<line class="cls-1" x1="4" y1="24" x2="44" y2="24"/>` +
    `<path class="cls-1" d="M8 20v-4h32v4"/>` +
    `</svg>`;
  const out = api.normalizePictogramSvg(input);
  assert(/width="64"/.test(out) && /height="64"/.test(out), 'bank root size 64');
  assert(/viewBox="0 0 48 48"/.test(out), 'bank viewBox preserved');
  assert(/stroke:#000000/.test(out) || /stroke="#000000"/.test(out), 'bank stroke color');
  assert(/stroke-width:0\.25/.test(out), 'CSS stroke-width added');
  assert(/stroke-width="0\.25"/.test(out), 'element stroke-width set');
  assert(/fill:none/.test(out) && /fill="none"/.test(out), 'fill none in CSS and attrs');
}

// Missing viewBox gets default 0 0 64 64
{
  const out = api.normalizePictogramSvg(
    `<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10" stroke="red"/></svg>`
  );
  assert(/viewBox="0 0 64 64"/.test(out), 'adds default viewBox');
}

// Non-SVG passthrough
{
  assert(api.normalizePictogramSvg('') === '', 'empty');
  assert(api.normalizePictogramSvg('not-svg') === 'not-svg', 'non-svg unchanged');
}

// Bank files with <?xml …?> prolog must still normalize (girl/boy bank assets)
{
  const input =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg id="Layer_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><style>.cls-1{fill:none;stroke:#000;}</style></defs>` +
    `<path class="cls-1" d="M10 32h44"/>` +
    `</svg>`;
  assert(api.stripSvgProlog(input).startsWith('<svg'), 'stripSvgProlog drops xml decl');
  const out = api.normalizePictogramSvg(input);
  assert(out.startsWith('<svg'), 'normalized output has no xml decl');
  assert(/width="64"/.test(out) && /height="64"/.test(out), 'xml-prefixed bank gets size 64');
  assert(/stroke-width="0\.25"/.test(out), 'xml-prefixed bank gets stroke attrs');
}

// External → bank canvas: square glyph fills 42 with 3-unit margins
{
  const input =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">` +
    `<path d="M2 12h20" fill="none" stroke="#000" stroke-width="0.25"/>` +
    `</svg>`;
  // Force deterministic bbox (stroke-inclusive 24×24)
  const out = api.normalizeExternalToBankCanvas(input, {
    bbox: { x: 0, y: 0, width: 24, height: 24, strokeWidth: 0.25 },
  });
  assert(api.isBankCanvasSvg(out), 'fitted svg is bank canvas');
  assert(/data-pgmr-bank="1"/.test(out), 'bank marker set');
  assert(/height="48"/.test(out), 'canvas height 48');
  assert(/viewBox="0 0 48 48"/.test(out), 'square content → 48×48 viewBox');
  assert(/width="48"/.test(out), 'canvas width 48');
  // scale = 42/24 = 1.75; stroke-width = 1/1.75 ≈ 0.571429
  assert(/scale\(1\.75\)/.test(out), 'uniform scale 1.75');
  assert(/stroke-width="0\.571429"/.test(out), 'stroke-width = 1/scale');
  assert(/stroke-linecap="round"/.test(out) && /stroke-linejoin="round"/.test(out), 'round caps/joins');
  // Content origin at margin 3,3 for square fill
  assert(/translate\(3,3\)/.test(out), 'content inset 3 from left/top when square');
}

// Wide glyph: larger dim is width → height < 42, bottom margin 3
{
  const out = api.normalizeExternalToBankCanvas(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 10"><path d="M0 5h40"/></svg>`,
    { bbox: { x: 0, y: 0, width: 40, height: 10, strokeWidth: 0 } }
  );
  // scale = 42/40 = 1.05; contentW=42, contentH=10.5; canvasW=48; yTop=48-3-10.5=34.5
  assert(/viewBox="0 0 48 48"/.test(out), 'wide glyph canvas width 48');
  assert(/scale\(1\.05\)/.test(out), 'scale from width');
  assert(/translate\(3,34\.5\)/.test(out), 'bottom margin 3 (yTop 34.5)');
  assert(/stroke-width="0\.952381"/.test(out), 'stroke 1/1.05');
}

// Tall glyph: larger dim is height
{
  const out = api.normalizeExternalToBankCanvas(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 40"><path d="M5 0v40"/></svg>`,
    { bbox: { x: 0, y: 0, width: 10, height: 40, strokeWidth: 0 } }
  );
  // scale = 42/40 = 1.05; contentW=10.5; canvasW=16.5; yTop=3
  assert(/viewBox="0 0 16\.5 48"/.test(out), 'tall glyph width = content+6');
  assert(/width="16\.5"/.test(out), 'root width 16.5');
  assert(/translate\(3,3\)/.test(out), 'tall glyph top/left margin 3');
}

// Idempotent: bank file is not re-fitted
{
  const bank =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="32.8" height="48" viewBox="0 0 32.8 48">` +
    `<g transform="translate(-10,-2) scale(1.1)" stroke-width="0.909">` +
    `<path d="M10 10h10" fill="none" stroke="#000"/>` +
    `</g></svg>`;
  assert(api.isBankCanvasSvg(bank), 'water-like bank detected');
  const out = api.normalizeExternalToBankCanvas(bank);
  assert(/viewBox="0 0 32\.8 48"/.test(out), 'bank viewBox preserved');
  assert(/scale\(1\.1\)/.test(out), 'bank scale wrapper preserved');
  assert(/stroke-width="0\.909"/.test(out), 'bank stroke-width preserved');
}

// preparePictogramSvg: bank source skips fit
{
  const stream =
    `<svg viewBox="0 0 24 24"><path d="M2 12h20" stroke="#000" stroke-width="0.25"/></svg>`;
  const fitted = api.preparePictogramSvg(stream, {
    source: 'streamline-new',
    bbox: { x: 0, y: 0, width: 24, height: 24 },
  });
  assert(api.isBankCanvasSvg(fitted), 'external prepared to bank canvas');
  const bankKeep = api.preparePictogramSvg(
    `<svg width="40" height="48" viewBox="0 0 40 48"><path d="M0 0h1"/></svg>`,
    { source: 'bank' }
  );
  assert(/viewBox="0 0 40 48"/.test(bankKeep), 'bank prepare keeps viewBox');
}

// Display gap in bank units
{
  const gap = api.bankDisplayGapUnits();
  assert(Math.abs(gap - (0.875 * 48) / 105) < 1e-9, 'gap units = 0.875px at 105px height');
}

console.log('All normalize-pictogram-svg tests passed.');
