/**
 * Archive card — State 3 chrome only (fade in on open).
 * Shared across hover→card (same DOM, never remounted here):
 *   number, name, brackets, icon, parameters — owned by the list row / hover layer.
 *
 * Layout: absolute 1920-frame coordinates from Memory card.svg + MCP layout boxes.
 * No flex/gap/padding driving position. Text (except body / param columns / source
 * row width) is right-edge anchored with no set width.
 * Body grows with text; if it crosses the output's y, output shifts by that overflow.
 * Title row and icon are not touched here.
 */
(function (global) {
  const STYLE_ID = 'archive-card-styles';
  /* SVG order: תדירות 21%, בהירות 51%, השפעת 57% */
  const PARAM_LABELS = [
    { key: 'frequency', label: 'תדירות הזיכרון' },
    { key: 'clarity', label: 'בהירות הזיכרון' },
    { key: 'impact', label: 'השפעת הזיכרון' },
  ];

  /* From Memory card.svg + MCP layout boxes (not getBBox). */
  const FRAME_W = 1920;
  const BODY_X = 658.806;
  const BODY_Y = 377.828;
  const BODY_W = 393;
  const OUTPUT_X = 292.806;
  const OUTPUT_Y = 545;
  const OUTPUT_W = 1089;
  const OUTPUT_H = 150;
  const SOURCE_X = 1061.81;
  const SOURCE_Y = 296;
  const SOURCE_W = 320;
  const SOURCE_RIGHT = SOURCE_X + SOURCE_W; /* 1381.81 */
  /* Value column right edges = label translate x from SVG */
  const SOURCE_TYPE_VALUE_RIGHT = 1173.04;
  const SOURCE_KIND_VALUE_RIGHT = 1174.76;
  const PARAMS_X = 1586.99;
  const PARAMS_Y = 810;
  const PARAMS_W = 251.014;
  const PARAM_VALUE_W = 44.727;
  const PARAM_LABEL_X = 74.727;
  const PARAM_LABEL_W = 176.287;
  const CLOSE_S = 38.976;
  /* Same right edge as source block + output ink */
  const SHARED_RIGHT = SOURCE_RIGHT; /* 1381.81 */
  const OUTPUT_RIGHT = SHARED_RIGHT;

  const STYLE_TEXT = `
.archive-card{
  position:relative;width:100%;height:100%;overflow:visible;pointer-events:none
}
.archive-card > *{pointer-events:auto}
.archive-card-close{
  position:absolute;z-index:4;border:0;background:transparent;padding:0;margin:0;cursor:pointer;appearance:none;
  width:calc(${CLOSE_S} * var(--figma-unit));
  height:calc(${CLOSE_S} * var(--figma-unit));
  background-image:url('/memory-processor/assets/archive/close-x.svg');
  background-repeat:no-repeat;background-position:center;background-size:contain
}
.archive-card-close:hover{opacity:.7}
/* Source row box 320 wide. Texts: no width — right-edge anchored. */
.archive-card-source{
  position:absolute;z-index:2;
  left:calc(${SOURCE_X} * var(--figma-unit));
  top:calc(${SOURCE_Y} * var(--figma-unit));
  width:calc(${SOURCE_W} * var(--figma-unit));
  height:calc(103 * var(--figma-unit));
  margin:0;padding:0;
  font-family:var(--font-mono);font-weight:400;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit));
  color:#000;text-align:right
}
.archive-card-source-type-value,
.archive-card-source-type-label,
.archive-card-source-kind-value,
.archive-card-source-kind-label,
.archive-card-source-name{
  position:absolute;left:auto;margin:0;padding:0;width:auto;
  box-sizing:border-box;text-align:right;white-space:nowrap
}
.archive-card-source-type-label{
  right:0;top:0;height:calc(19 * var(--figma-unit))
}
.archive-card-source-type-value{
  right:calc(${SOURCE_RIGHT - SOURCE_TYPE_VALUE_RIGHT} * var(--figma-unit));
  top:0;height:calc(19 * var(--figma-unit))
}
.archive-card-source-kind-label{
  right:0;top:calc(51 * var(--figma-unit));height:calc(19 * var(--figma-unit))
}
.archive-card-source-kind-value{
  right:calc(${SOURCE_RIGHT - SOURCE_KIND_VALUE_RIGHT} * var(--figma-unit));
  top:calc(51 * var(--figma-unit));height:calc(19 * var(--figma-unit))
}
.archive-card-source-name{
  right:0;top:calc(78 * var(--figma-unit));height:calc(25 * var(--figma-unit));
  font-family:var(--font-display);font-weight:500;
  font-size:calc(22 * var(--figma-unit));line-height:calc(25 * var(--figma-unit));
  color:#000
}
.archive-card-body{
  position:absolute;z-index:2;
  left:calc(${BODY_X} * var(--figma-unit));
  top:calc(${BODY_Y} * var(--figma-unit));
  margin:0;padding:0;
  width:calc(${BODY_W} * var(--figma-unit));
  height:auto;max-width:calc(${BODY_W} * var(--figma-unit));
  overflow:visible;overflow-wrap:break-word;word-break:break-word;
  font-family:var(--font-display);font-weight:500;
  font-size:calc(22 * var(--figma-unit));line-height:calc(25 * var(--figma-unit));
  color:#000;text-align:right;direction:rtl
}
.archive-card-output{
  position:absolute;z-index:2;
  left:calc(${OUTPUT_X} * var(--figma-unit));
  top:calc(${OUTPUT_Y} * var(--figma-unit));
  width:calc(${OUTPUT_W} * var(--figma-unit));
  height:calc(${OUTPUT_H} * var(--figma-unit));
  margin:0;padding:0;
  line-height:0;overflow:hidden
}
.archive-card-output svg{display:block;max-width:none;max-height:none}
/* Params — 251.014 wide; value 44.727; label 176.287 at +74.727; rows y 810/861/912 */
.archive-card-params{
  position:absolute;
  left:calc(${PARAMS_X} * var(--figma-unit));
  top:calc(${PARAMS_Y} * var(--figma-unit));
  width:calc(${PARAMS_W} * var(--figma-unit));
  height:calc(121 * var(--figma-unit));
  margin:0;padding:0;
  font-family:var(--font-mono);font-size:calc(18 * var(--figma-unit));
  line-height:calc(19 * var(--figma-unit));color:#000;text-align:right;z-index:2;
  pointer-events:none
}
.archive-card-param{
  position:absolute;left:0;width:100%;height:calc(19 * var(--figma-unit));
  margin:0;padding:0
}
.archive-card-param:nth-child(1){top:0}
.archive-card-param:nth-child(2){top:calc(51 * var(--figma-unit))}
.archive-card-param:nth-child(3){top:calc(102 * var(--figma-unit))}
.archive-card-param-value{
  position:absolute;left:0;top:0;
  width:calc(${PARAM_VALUE_W} * var(--figma-unit));height:100%;
  margin:0;padding:0;text-align:right;white-space:nowrap;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit))
}
.archive-card-param-label{
  position:absolute;left:calc(${PARAM_LABEL_X} * var(--figma-unit));top:0;
  width:calc(${PARAM_LABEL_W} * var(--figma-unit));height:100%;
  margin:0;padding:0;text-align:right;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit))
}
.archive-card-nav{
  position:absolute;z-index:4;border:0;background:transparent;padding:0;margin:0;cursor:pointer;appearance:none;
  width:calc(var(--archive-chevron-size) * var(--figma-unit));
  height:calc(var(--archive-chevron-size) * var(--figma-unit));
  top:calc(989 * var(--figma-unit));
  background-repeat:no-repeat;background-position:center;background-size:contain
}
.archive-card-nav-prev{
  left:calc(var(--archive-chevron-prev-x) * var(--figma-unit));
  background-image:url('/memory-processor/assets/archive/chevron-back.svg')
}
.archive-card-nav-next{
  left:calc(var(--archive-chevron-next-x) * var(--figma-unit));
  background-image:url('/memory-processor/assets/archive/chevron-forward.svg')
}
@media(max-width:760px){
  .archive-card-body,.archive-card-source,.archive-card-output,.archive-card-params{
    position:static;width:auto;max-width:100%;left:auto;right:auto;top:auto;height:auto
  }
  .archive-card-source{width:100%;margin-bottom:16px}
  .archive-card-source-type-value,
  .archive-card-source-type-label,
  .archive-card-source-kind-value,
  .archive-card-source-kind-label,
  .archive-card-source-name,
  .archive-card-param,
  .archive-card-param-value,
  .archive-card-param-label{
    position:static;width:auto;height:auto;left:auto;right:auto;top:auto
  }
  .archive-card-body{margin-top:16px;width:100%;max-width:100%}
  .archive-card-close{position:absolute;right:16px;top:16px;left:auto}
  .archive-card-nav{display:none}
}
`;

  let layoutSyncBound = null;

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    if (style.textContent !== STYLE_TEXT) style.textContent = STYLE_TEXT;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pct(n) {
    return n == null ? '—' : `${n}%`;
  }

  /** Normalize source: string | { type, category?, kind?, name? } */
  function normalizeSource(source) {
    if (source == null) return null;
    if (typeof source === 'string') return { type: source };
    if (typeof source === 'object') return source;
    return null;
  }

  function isMediatedSource(source) {
    return !!(source && source.type && source.type !== 'אישי');
  }

  function figmaUnitPx() {
    return Math.min(window.innerWidth / FRAME_W, 1);
  }

  function detailFrame() {
    return document.getElementById('archive-detail-view');
  }

  /** Screen Y of the name's alphabetic baseline (list-row title). */
  function measureNameBaseline(nameEl) {
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    marker.setAttribute('aria-hidden', 'true');
    marker.style.cssText =
      'display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline;padding:0;border:0;margin:0';
    nameEl.appendChild(marker);
    const y = marker.getBoundingClientRect().top;
    marker.remove();
    return y;
  }

  /**
   * × lives in the card frame; the name lives in the list-row.
   * Vertical: bottom on the name baseline. Horizontal: right edge at SHARED_RIGHT (1381.81).
   */
  function syncCloseToName(closeBtn) {
    const name = document.querySelector('.archive-memory-row.is-open .archive-row-title');
    const frame = detailFrame();
    if (!closeBtn || !name || !frame) return;
    const unit = figmaUnitPx();
    if (unit <= 0) return;
    const frameRect = frame.getBoundingClientRect();
    const baseline = measureNameBaseline(name);
    const top = (baseline - frameRect.top) / unit - CLOSE_S;
    const left = SHARED_RIGHT - CLOSE_S;
    closeBtn.style.top = `calc(${top} * var(--figma-unit))`;
    closeBtn.style.left = `calc(${left} * var(--figma-unit))`;
  }

  /** Output y = OUTPUT_Y, plus body overflow past that coordinate. */
  function syncOutputToBody(body, output) {
    if (!body || !output) return;
    const unit = figmaUnitPx();
    if (unit <= 0) return;
    const bodyBottom = BODY_Y + body.getBoundingClientRect().height / unit;
    const overflow = Math.max(0, bodyBottom - OUTPUT_Y);
    output.style.top = `calc(${OUTPUT_Y + overflow} * var(--figma-unit))`;
  }

  /**
   * Box right edge is 1381.81; artwork may have empty space on its right.
   * Shift the box so the drawing's ink right edge lands on 1381.81.
   */
  function alignOutputInk(output) {
    const svg = output?.querySelector('svg');
    const frame = detailFrame();
    if (!svg || !frame) return;
    const unit = figmaUnitPx();
    if (unit <= 0) return;
    let inkRight;
    try {
      const b = svg.getBBox();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = svg.createSVGPoint();
      const xs = [];
      for (const [x, y] of [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x, b.y + b.height],
        [b.x + b.width, b.y + b.height],
      ]) {
        p.x = x;
        p.y = y;
        xs.push(p.matrixTransform(ctm).x);
      }
      inkRight = Math.max(...xs);
    } catch {
      return;
    }
    const frameRect = frame.getBoundingClientRect();
    const targetRightPx = frameRect.left + OUTPUT_RIGHT * unit;
    const deltaPx = targetRightPx - inkRight;
    const hostRect = output.getBoundingClientRect();
    const newLeft = (hostRect.left - frameRect.left + deltaPx) / unit;
    output.style.left = `calc(${newLeft} * var(--figma-unit))`;
  }

  function syncCardLayout(closeBtn, body, output) {
    syncCloseToName(closeBtn);
    if (output) {
      output.style.left = `calc(${OUTPUT_X} * var(--figma-unit))`;
      syncOutputToBody(body, output);
      alignOutputInk(output);
    }
  }

  function bindLayoutSync(closeBtn, body, output) {
    if (layoutSyncBound) {
      window.removeEventListener('resize', layoutSyncBound);
      layoutSyncBound = null;
    }
    const run = () => syncCardLayout(closeBtn, body, output);
    layoutSyncBound = run;
    window.addEventListener('resize', run);
    run();
    requestAnimationFrame(run);
    if (document.fonts?.ready) document.fonts.ready.then(run).catch(() => {});
  }

  function renderSource(memory) {
    const root = document.createElement('div');
    root.className = 'archive-card-source';
    root.setAttribute('aria-label', 'מקור הזיכרון');

    const source = normalizeSource(memory?.source);
    const type = source?.type || '';

    const typeValue = document.createElement('span');
    typeValue.className = 'archive-card-source-type-value';
    typeValue.textContent = type;
    root.appendChild(typeValue);

    const typeLabel = document.createElement('span');
    typeLabel.className = 'archive-card-source-type-label';
    typeLabel.textContent = 'מקור הזיכרון';
    root.appendChild(typeLabel);

    if (isMediatedSource(source)) {
      if (source.kind || source.category) {
        const kindValue = document.createElement('span');
        kindValue.className = 'archive-card-source-kind-value';
        kindValue.textContent = source.kind || '';
        root.appendChild(kindValue);

        const kindLabel = document.createElement('span');
        kindLabel.className = 'archive-card-source-kind-label';
        kindLabel.textContent = source.category || '';
        root.appendChild(kindLabel);
      }
      if (source.name) {
        const name = document.createElement('span');
        name.className = 'archive-card-source-name';
        name.textContent = source.name;
        root.appendChild(name);
      }
    }

    return root;
  }

  /** Read-only generator parameters — order matches SVG: תדירות, בהירות, השפעת. */
  function renderParameters(memory) {
    const root = document.createElement('div');
    root.className = 'archive-card-params';
    root.setAttribute('aria-label', 'פרמטרי הזיכרון');
    if (memory?.id) root.dataset.memoryId = memory.id;
    PARAM_LABELS.forEach(({ key, label }) => {
      const row = document.createElement('div');
      row.className = 'archive-card-param';
      row.innerHTML = `
        <span class="archive-card-param-value">${escapeHtml(pct(memory[key]))}</span>
        <span class="archive-card-param-label">${escapeHtml(label)}</span>`;
      root.appendChild(row);
    });
    return root;
  }

  async function mountSvg(host, src) {
    if (!host) return null;
    if (!src) {
      host.replaceChildren();
      return null;
    }
    const loader = global.ArchiveListRow?.loadInlineSvg;
    if (!loader) {
      console.warn('[archive] svg loader missing');
      return null;
    }
    host.setAttribute('data-pending', src);
    try {
      const svg = await loader(src);
      if (host.getAttribute('data-pending') !== src) return null;
      host.replaceChildren(svg);
      host.removeAttribute('data-pending');
      return svg;
    } catch (err) {
      console.warn('[archive] svg failed', src, err);
      if (host.getAttribute('data-pending') === src) {
        host.replaceChildren();
        host.removeAttribute('data-pending');
      }
      return null;
    }
  }

  /**
   * Mount card-only elements into the detail host (×, source, body, output, chevrons).
   * Does not touch number / name / brackets / icon / parameters.
   * handlers: { onClose, onPrev, onNext }
   */
  function mount(host, memory, handlers = {}) {
    ensureStyles();
    global.ArchiveListRow?.ensureStyles?.();
    if (!host || !memory) return null;

    const card = document.createElement('div');
    card.className = 'archive-card';
    card.dataset.id = memory.id;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'archive-card-close';
    closeBtn.setAttribute('aria-label', 'סגור זיכרון');
    closeBtn.addEventListener('click', () => handlers.onClose?.(memory));
    card.appendChild(closeBtn);

    card.appendChild(renderSource(memory));

    const body = document.createElement('p');
    body.className = 'archive-card-body';
    body.textContent = memory.body || '';
    card.appendChild(body);

    const outputHost = document.createElement('div');
    outputHost.className = 'archive-card-output';
    card.appendChild(outputHost);

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'archive-card-nav archive-card-nav-prev';
    prevBtn.setAttribute('aria-label', 'זיכרון קודם');
    prevBtn.addEventListener('click', () => handlers.onPrev?.(memory));
    card.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'archive-card-nav archive-card-nav-next';
    nextBtn.setAttribute('aria-label', 'זיכרון הבא');
    nextBtn.addEventListener('click', () => handlers.onNext?.(memory));
    card.appendChild(nextBtn);

    host.replaceChildren(card);
    bindLayoutSync(closeBtn, body, outputHost);
    mountSvg(outputHost, memory.output).then(() => {
      syncCardLayout(closeBtn, body, outputHost);
    });
    return card;
  }

  function clear(host) {
    if (layoutSyncBound) {
      window.removeEventListener('resize', layoutSyncBound);
      layoutSyncBound = null;
    }
    if (host) host.replaceChildren();
  }

  function preload(memory) {
    const loader = global.ArchiveListRow?.loadInlineSvg;
    if (!loader || !memory) return;
    if (memory.icon) loader(memory.icon).catch(() => {});
    if (memory.output) loader(memory.output).catch(() => {});
  }

  /** Memories with icon + output can open State 3. */
  function canOpen(memory) {
    return !!(memory?.output && memory?.icon);
  }

  function missingOpenAssets(memory) {
    const missing = [];
    if (!memory?.icon) missing.push('icon');
    if (!memory?.output) missing.push('output');
    return missing;
  }

  global.ArchiveCard = {
    ensureStyles,
    mount,
    clear,
    preload,
    renderParameters,
    canOpen,
    missingOpenAssets,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
