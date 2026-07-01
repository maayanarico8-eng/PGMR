/**
 * Re-runnable extraction: sprite-inner.svg + viewbox-manifest.json → bank/{word}.svg
 * Run: node memory-processor/scripts/extract-pictograms.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENTRIES = path.join(ROOT, 'engine/catalog/entries.js');
const BANK = path.join(ROOT, 'pictograms/bank');
const SPRITE = path.join(ROOT, 'pictograms/sprite-inner.svg');
const MANIFEST = path.join(ROOT, 'pictograms/viewbox-manifest.json');

function loadEntries() {
  const g = globalThis;
  // eslint-disable-next-line no-eval
  eval(fs.readFileSync(ENTRIES, 'utf8'));
  return g.MemoryEngineCatalogEntries || [];
}

function assetFilename(hebrew) {
  const primary = (hebrew || '').trim().split('/')[0].trim();
  if (!primary) throw new Error('empty hebrew label');
  return `${primary}.svg`;
}

function wrapSvg(viewBox, inner) {
  return (
    `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" overflow="hidden">` +
    inner +
    '</svg>'
  );
}

function main() {
  if (!fs.existsSync(SPRITE)) {
    console.error('Missing sprite-inner.svg — run initial extraction from HTML first');
    process.exit(1);
  }
  const inner = fs.readFileSync(SPRITE, 'utf8');
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const entries = loadEntries();

  fs.mkdirSync(BANK, { recursive: true });
  let written = 0;
  entries.forEach((entry) => {
    const key = entry.hebrew.trim().split('/')[0].trim();
    const viewBox = entry.viewBox || manifest[key];
    if (!viewBox) {
      console.warn(`skip ${entry.id}: no viewBox`);
      return;
    }
    const svg = wrapSvg(viewBox, inner);
    const filename = assetFilename(entry.hebrew);
    fs.writeFileSync(path.join(BANK, filename), svg, 'utf8');
    fs.writeFileSync(path.join(BANK, entry.id + '.svg'), svg, 'utf8');
    written++;
    console.log(`wrote ${filename} (${entry.id})`);
  });
  console.log(`Done: ${written} pictograms in ${BANK}`);
}

main();
