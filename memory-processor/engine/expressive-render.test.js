/**
 * Expressive rendering unit tests
 * Run: node memory-processor/engine/expressive-render.test.js
 */
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const api = require('./expressive-render.js');

function sampleSequence(n = 2) {
  const ps = 64;
  const gap = 24;
  const cW = Math.max(320, n * ps + (n - 1) * gap + 40);
  const cH = 128;
  const totW = n * ps + (n - 1) * gap;
  const x0 = (cW - totW) / 2;
  const y0 = (cH - ps) / 2;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (ps + gap);
    parts.push(
      `<g transform="translate(${x},${y0})">` +
        `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
        `<path d="M8 32h48" fill="#fff" stroke="#000" stroke-width="2"/>` +
        `<circle cx="32" cy="32" r="10" style="fill:red"/>` +
        `</svg></g>`
    );
  }
  return `<svg viewBox="0 0 ${cW} ${cH}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

console.log('expressive-render tests…');

// Defaults
{
  const d = api.DEFAULT_PARAMS;
  assert(d.memorySource === 0, 'default source mine');
  assert(d.memoryFrequency === 100, 'default freq 100');
  assert(d.memoryClarity === 100, 'default clarity 100');
  assert(d.memoryImpact === 0, 'default impact 0');
}

// Impact
{
  assert(api.computeStrokeWidth(0) === 0.5, 'impact 0 → stroke 0.5');
  assert(approx(api.computeStrokeWidth(100), 13.775), 'impact 100 → former impact 45 stroke');
  assert(approx(api.computeStrokeWidth(50), 7.1375), 'impact 50 → half of rescaled range');
}

// Frequency — slider 0–100 maps onto former 8–100% range
{
  const solid = api.computeDash(100, 1);
  assert(solid.solid === true, 'freq 100 solid');
  assert(solid.dasharray === null, 'freq 100 no dasharray');

  const mid = api.computeDash(50);
  assert(mid.solid === false, 'freq 50 dashed');
  assert(typeof mid.dasharray === 'string' && mid.dasharray.includes(' '), 'dasharray pair');

  const low = api.computeDash(0);
  assert(low.solid === false, 'freq 0 dashed');
  assert(low.dash >= 0.01, 'dash floor');
  // New 0% must match the former 8% look: f=0.08 → dash = 12 * 0.08^1.6
  const former8Dash = 12 * Math.pow(0.08, 1.6);
  assert(approx(low.dash, former8Dash), 'freq 0 ≡ former freq 8 dash');
  const former8Gap = Math.max(0.6 + 6.8 * (1 - 0.08), 1.6 * 0.5);
  assert(approx(low.gap, former8Gap), 'freq 0 ≡ former freq 8 gap');

  const sameFrequencyThin = api.applyExpressiveRendering(sampleSequence(1), {
    ...api.DEFAULT_PARAMS,
    memoryFrequency: 40,
    memoryImpact: 0,
  });
  const sameFrequencyThick = api.applyExpressiveRendering(sampleSequence(1), {
    ...api.DEFAULT_PARAMS,
    memoryFrequency: 40,
    memoryImpact: 100,
  });
  assert(
    sameFrequencyThin.state.dasharray === sameFrequencyThick.state.dasharray,
    'impact does not reposition frequency dash segments'
  );
}

// Clarity
{
  assert(approx(api.computeCollapseScale(100), 1), 'clarity 100 → 1');
  assert(approx(api.computeCollapseScale(0), 0.02), 'clarity 0 → 0.02');
  assert(api.computeCollapseScale(50) < 1 && api.computeCollapseScale(50) > 0.02, 'clarity mid between');
}

// Fragmentation
{
  assert(api.fragOffset(0, 0, 0) === 0, 'mine offset 0');
  assert(api.fragOffset(1, 0, 0) === 18, 'family even/even +18');
  assert(api.fragOffset(1, 0, 1) === -18, 'family even/odd -18');
  assert(api.fragOffset(1, 1, 0) === -18, 'family odd/even -18');
  assert(api.fragOffset(1, 1, 1) === 18, 'family odd/odd +18');
  assert(api.fragOffset(2, 0, 0) === 18, 'acquaintance same magnitude');
  assert(api.FRAG_STRIPS[0] === 1 && api.FRAG_STRIPS[1] === 4 && api.FRAG_STRIPS[2] === 4, 'strip counts');
}

// apply — mine defaults
{
  const base = sampleSequence(2);
  const { svg, state } = api.applyExpressiveRendering(base, api.DEFAULT_PARAMS);
  assert(state.pictogramCount === 2, 'detects 2 pictograms');
  assert(state.stripsPerPictogram === 1, 'mine → 1 strip');
  assert(state.maxOffset === 0, 'mine maxOffset 0');
  assert(state.dasharray === 'solid', 'default dash solid');
  assert(state.strokeWidth === 0.5, 'default stroke 0.5');
  assert(approx(state.collapseScale, 1), 'default collapse 1');
  assert(svg.includes('ex-master-0'), 'master in defs');
  assert(svg.includes('stroke="#000000"') || svg.includes("stroke='#000000'"), 'normalized stroke color');
  assert(svg.includes('stroke-linecap="round"'), 'round linecap');
  assert(!svg.includes('fill="#fff"') && !svg.includes('fill="#FFF"'), 'fill overridden on path');
  assert(svg.includes('viewBox="'), 'has viewBox');
  // padding expands viewBox
  assert(state.pad >= 12, 'pad at least 12');
}

// Impact must not change viewBox (no canvas jump / pictogram shift)
{
  const base = sampleSequence(2);
  const low = api.applyExpressiveRendering(base, { ...api.DEFAULT_PARAMS, memoryImpact: 0 });
  const high = api.applyExpressiveRendering(base, { ...api.DEFAULT_PARAMS, memoryImpact: 100 });
  const vb = (svg) => (svg.match(/viewBox="([^"]+)"/) || [])[1];
  assert(vb(low.svg) === vb(high.svg), 'impact 0 and 100 share viewBox');
  assert(low.state.pad === high.state.pad, 'pad stable across impact');
  assert(low.state.strokeWidth === 0.5 && approx(high.state.strokeWidth, 13.775), 'stroke still scales');
}

// Memory source must not resize the displayed sequence
{
  const base = sampleSequence(2);
  const mine = api.applyExpressiveRendering(base, { ...api.DEFAULT_PARAMS, memorySource: 0 });
  const family = api.applyExpressiveRendering(base, { ...api.DEFAULT_PARAMS, memorySource: 1 });
  const acquaintance = api.applyExpressiveRendering(base, { ...api.DEFAULT_PARAMS, memorySource: 2 });
  const vb = (svg) => (svg.match(/viewBox="([^"]+)"/) || [])[1];
  assert(vb(mine.svg) === vb(family.svg), 'personal and family sources share viewBox');
  assert(vb(mine.svg) === vb(acquaintance.svg), 'personal and acquaintance sources share viewBox');
  assert(mine.state.pad === family.state.pad && mine.state.pad === acquaintance.state.pad, 'source padding remains stable');
}

// apply — family fragmentation
{
  const { svg, state } = api.applyExpressiveRendering(sampleSequence(2), {
    memorySource: 1,
    memoryFrequency: 100,
    memoryClarity: 100,
    memoryImpact: 0,
  });
  assert(state.stripsPerPictogram === 4, 'family → 4 strips');
  assert(state.maxOffset === 18, 'family maxOffset 18');
  assert((svg.match(/<clipPath id="ex-clip-0-/g) || []).length === 4, '4 clips for pictogram 0');
  assert((svg.match(/<clipPath id="ex-clip-1-/g) || []).length === 4, '4 clips for pictogram 1');
  assert(svg.includes('clipPath'), 'has clipPath');
}

// apply — acquaintance
{
  const { state } = api.applyExpressiveRendering(sampleSequence(1), {
    memorySource: 2,
    memoryFrequency: 100,
    memoryClarity: 0,
    memoryImpact: 0,
  });
  assert(state.stripsPerPictogram === 4, 'acquaintance → 4 strips');
  assert(state.pictogramCount === 1, 'single pictogram');
  // single pictogram: clarity has no effect on positions (dx=0) but scale still recorded
  assert(approx(state.collapseScale, 0.02), 'clarity 0 recorded');
}

// apply — frequency dash in output
{
  const { svg, state } = api.applyExpressiveRendering(sampleSequence(2), {
    memorySource: 0,
    memoryFrequency: 40,
    memoryClarity: 100,
    memoryImpact: 50,
  });
  assert(state.dasharray !== 'solid', 'dashed state');
  assert(svg.includes('stroke-dasharray='), 'dasharray in svg');
  assert(approx(state.strokeWidth, 7.1375), 'rescaled impact mid stroke in state');
}

// apply — clarity collapse factor
{
  const { state } = api.applyExpressiveRendering(sampleSequence(3), {
    memorySource: 0,
    memoryFrequency: 100,
    memoryClarity: 0,
    memoryImpact: 0,
  });
  assert(approx(state.collapseScale, 0.02), 'collapse at clarity 0');
}

// Layout positions must come from sequence translates, not local getBBox metrics
{
  const base = sampleSequence(3);
  const resolved = api._resolvePictograms(base, {
    metrics: [
      { x: 2, y: 4, width: 50, height: 50 },
      { x: 1, y: 3, width: 52, height: 52 },
      { x: 0, y: 2, width: 55, height: 55 },
    ],
  });
  assert(resolved.pictograms.length === 3, '3 pictograms');
  const xs = resolved.pictograms.map((p) => p.x);
  assert(xs[1] > xs[0] + 60, 'second pictogram to the right of first');
  assert(xs[2] > xs[1] + 60, 'third pictogram to the right of second');
  // bbox may use metrics, but slot origin stays on layout grid
  assert(resolved.pictograms[0].bbox.width === 50, 'bbox width from metrics');
}

// Default params keep distinct horizontal placements in output
{
  const base = sampleSequence(3);
  const { svg } = api.applyExpressiveRendering(base, api.DEFAULT_PARAMS);
  const translates = [...svg.matchAll(/translate\(([-\d.]+),/g)].map((m) => Number(m[1]));
  // Expect pictogram placement translates (ignore clarity 0 wrappers): distinct slot xs
  const slotXs = translates.filter((x) => x > 20);
  assert(slotXs.length >= 3, 'has placement translates');
  assert(new Set(slotXs.map((x) => Math.round(x))).size >= 3, 'distinct horizontal slots');
}

// Determinism
{
  const params = {
    memorySource: 1,
    memoryFrequency: 55,
    memoryClarity: 70,
    memoryImpact: 25,
  };
  const base = sampleSequence(3);
  const a = api.applyExpressiveRendering(base, params).svg;
  const b = api.applyExpressiveRendering(base, params).svg;
  assert(a === b, 'identical params → identical svg');
}

// Style normalization removes incoming style=
{
  const html = api._normalizeGraphicsInHtml(
    '<path d="M0 0" style="fill:red;stroke:blue"/>',
    4,
    { solid: true, dasharray: null }
  );
  assert(html.includes('fill="none"'), 'fill none');
  assert(html.includes('stroke="#000000"'), 'stroke color');
  assert(html.includes('stroke-width="4"'), 'stroke width');
  assert(!/\sstyle=/.test(html), 'style attr removed');
}

// Bank / manual-upload SVGs: <style>.cls-1{stroke-width:0.5} must not lock Impact
{
  const bankLike =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 48 48">` +
    `<defs><style>.cls-1{fill:none;stroke:#000;stroke-linecap:round;stroke-linejoin:round;stroke-width:0.5;}</style></defs>` +
    `<path class="cls-1" d="M8 24h32"/>` +
    `</svg>`;
  const seq =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<g transform="translate(0,0)">${bankLike}</g>` +
    `</svg>`;
  const { svg, state } = api.applyExpressiveRendering(seq, {
    ...api.DEFAULT_PARAMS,
    memoryImpact: 14,
  });
  assert(approx(state.strokeWidth, 2.3585), 'impact 14 → rescaled stroke');
  assert(/stroke-width="2\.359"/.test(svg), 'presentation stroke-width applied');
  assert(/stroke-width:2\.359/.test(svg), 'CSS stroke-width rewritten for Impact');
  assert(!/stroke-width:0\.5/.test(svg), 'CSS no longer locks 0.5');
}

// Real bank girl.svg (xml prolog + nested svg + cls-1) must survive sequence expressive path
{
  const fs = require('fs');
  const path = require('path');
  const normalizeApi = require('./catalog/normalize-pictogram-svg.js');
  globalThis.MemoryEngineNormalizePictogramSvg = normalizeApi;
  const girl = fs.readFileSync(path.join(__dirname, '../pictograms/bank/girl.svg'), 'utf8');
  assert(girl.trim().startsWith('<?xml'), 'fixture has xml prolog');
  const normalized = normalizeApi.normalizePictogramSvg(girl);
  assert(normalized.startsWith('<svg'), 'girl normalizes without xml prolog');
  const slotSvg = normalized.replace(/^<svg([^>]*)>/i, (m, attrs) => {
    let a = attrs.replace(/\s(?:width|height)="[^"]*"/gi, '');
    return `<svg width="64" height="64"${a} overflow="hidden">`;
  });
  const seq =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 128">` +
    `<g transform="translate(20,32)">${slotSvg}</g>` +
    `</svg>`;
  const { svg, state } = api.applyExpressiveRendering(seq, api.DEFAULT_PARAMS);
  assert(state.pictogramCount === 1, 'girl counts as one pictogram');
  assert(!/<\?xml/i.test(svg), 'expressive output has no xml prolog in masters');
  const master = svg.match(/id="ex-master-0">([\s\S]*?)<\/g>\s*<clipPath/)?.[1] || '';
  assert(master.length > 0, 'girl master exists');
  assert(!/^<svg\b/i.test(master.trim()), 'master unwraps nested svg root');
  assert(/39\.61,38\.03/.test(svg), 'girl path retained in sequence output');
  assert(/<use\b[^>]*href="#ex-master-0"/.test(svg), 'girl referenced via use');
}

console.log('All expressive-render tests passed.');
