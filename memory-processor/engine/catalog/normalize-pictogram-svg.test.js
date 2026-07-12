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
  assert(api.STROKE_WIDTH === '0.5', 'stroke width 0.5');
  assert(api.STROKE_COLOR === '#000000', 'stroke color #000000');
}

// Streamline-like inline attrs
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
  assert(/stroke-width="0\.5"/.test(out), 'path stroke-width 0.5');
  assert(/fill="none"/.test(out), 'fill none on graphics');
  assert(/style="[^"]*stroke:#000000/.test(out), 'inline style stroke rewritten');
  assert(/style="[^"]*stroke-width:0\.5/.test(out), 'inline style stroke-width rewritten');
}

// Bank-like CSS class SVG (no stroke-width in stylesheet)
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
  assert(/stroke-width:0\.5/.test(out), 'CSS stroke-width added');
  assert(/stroke-width="0\.5"/.test(out), 'element stroke-width set');
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

console.log('All normalize-pictogram-svg tests passed.');
