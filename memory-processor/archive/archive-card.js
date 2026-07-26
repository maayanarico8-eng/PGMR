/**
 * Archive card — State 3 chrome + State 4 body-text hover.
 * Shared across hover→card (same DOM, never remounted here):
 *   number, name, brackets, icon, parameters — owned by the list row / hover layer.
 *
 * Layout: absolute 1920-frame coordinates from Memory card.svg + MCP layout boxes.
 * No flex/gap/padding driving position. Text (except body / param columns / source
 * row width) is right-edge anchored with no set width.
 * Body grows with text; if it crosses the output's y, output shifts by that overflow.
 * Title row and icon are not touched here.
 *
 * State 4 (body hover): non-representative body segments hide in place (opacity 0,
 * still in flow); pictogram bank + sequence reveal. Leave body → State 3.
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
  const OUTPUT_W = 1089;
  /**
   * Output ink top — computed once from memory 001 (ink-centred between text bottom
   * and bank label top after the bank row was raised). Hard-set for every memory;
   * only pushed when body text grows down into this slot.
   */
  const OUTPUT_INK_TOP = 562.136;
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
  /* Same right edge as source block + output ink + sequence ink */
  const SHARED_RIGHT = SOURCE_RIGHT; /* 1381.81 */
  const OUTPUT_RIGHT = SHARED_RIGHT;
  /* State 4 — pictogram bank. Sequence ink right on SHARED_RIGHT; gap 8 kept.
   * Bank row raised so seq-ink→chevron-ink gap equals chevron-ink→page-bottom (61.667). */
  const SEQ_W = 936.83;
  const SEQ_H = 105;
  const SEQ_INK_RIGHT_MARGIN = 3.5; /* trailing margin inside last glyph box */
  const SEQ_X = SHARED_RIGHT - SEQ_W + SEQ_INK_RIGHT_MARGIN; /* 448.48 */
  const SEQ_SHIFT = SEQ_X - 439.228; /* +9.25 from Figma box origin */
  const BANK_ROW_LIFT = 20.142; /* ink-measured: equalise gaps around nav chevrons */
  const SEQ_Y = 848.643 - BANK_ROW_LIFT; /* 828.501 */
  const BANK_LABEL_X = 1195.941 + SEQ_SHIFT;
  const BANK_LABEL_Y = 795.143 - BANK_ROW_LIFT; /* 775.001 */
  const BANK_LABEL_W = 176.287;

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
  color:#000;text-align:right;direction:rtl;cursor:default
}
.archive-card-body-seg{margin:0;padding:0}
.archive-card.is-text-hover .archive-card-body-seg.is-muted{opacity:0}
.archive-card-pictograms{
  position:absolute;z-index:2;left:0;top:0;width:0;height:0;
  margin:0;padding:0;overflow:visible;pointer-events:none;
  opacity:0;visibility:hidden
}
.archive-card.is-text-hover .archive-card-pictograms{opacity:1;visibility:visible}
.archive-card-sequence{
  position:absolute;overflow:visible;margin:0;padding:0;
  left:calc(${SEQ_X} * var(--figma-unit));
  top:calc(${SEQ_Y} * var(--figma-unit));
  width:calc(${SEQ_W} * var(--figma-unit));
  height:calc(${SEQ_H} * var(--figma-unit))
}
.archive-card-sequence-item{
  position:absolute;top:0;margin:0;padding:0;overflow:visible;
  height:calc(${SEQ_H} * var(--figma-unit));line-height:0
}
.archive-card-sequence-item img,
.archive-card-sequence-item svg{
  display:block;width:100%;height:100%;max-width:none;max-height:none
}
.archive-card-bank-label{
  position:absolute;margin:0;padding:0;overflow:visible;
  left:calc(${BANK_LABEL_X} * var(--figma-unit));
  top:calc(${BANK_LABEL_Y} * var(--figma-unit));
  width:calc(${BANK_LABEL_W} * var(--figma-unit));
  height:calc(19 * var(--figma-unit));
  font-family:var(--font-mono);font-weight:400;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit));
  color:#000;text-align:right;white-space:nowrap
}
.archive-card-output{
  position:absolute;z-index:2;
  left:calc(${OUTPUT_X} * var(--figma-unit));
  top:calc(${OUTPUT_INK_TOP} * var(--figma-unit));
  width:calc(${OUTPUT_W} * var(--figma-unit));
  height:auto;margin:0;padding:0;
  line-height:0;overflow:visible
}
.archive-card-output svg{
  display:block;max-width:none;max-height:none;overflow:visible;
  margin:0;padding:0
}
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
  .archive-card-pictograms,.archive-card-sequence,.archive-card-bank-label{display:none}
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

  /**
   * Size host to ink (getBBox); scale stays OUTPUT_W / viewBox.width.
   * Vertical: hard-set OUTPUT_INK_TOP from 001; push only if body grows into that slot.
   * Horizontal: ink right → SHARED_RIGHT.
   */
  function syncOutputInkBox(body, output) {
    const svg = output?.querySelector('svg');
    if (!output || !svg) return;
    const unit = figmaUnitPx();
    if (unit <= 0) return;

    let vb;
    let ink;
    try {
      vb = svg.viewBox.baseVal;
      ink = svg.getBBox();
    } catch {
      return;
    }
    if (!vb.width || !ink.width || !ink.height) return;

    const scale = OUTPUT_W / vb.width;
    const padLeft = ink.x - vb.x;
    const padTop = ink.y - vb.y;
    const inkW = ink.width * scale;
    const inkH = ink.height * scale;

    const bodyBottom = body
      ? BODY_Y + body.getBoundingClientRect().height / unit
      : BODY_Y;
    const overflow = Math.max(0, bodyBottom - OUTPUT_INK_TOP);
    const top = OUTPUT_INK_TOP + overflow;
    const left = OUTPUT_RIGHT - inkW;

    output.style.width = `calc(${inkW} * var(--figma-unit))`;
    output.style.height = `calc(${inkH} * var(--figma-unit))`;
    output.style.top = `calc(${top} * var(--figma-unit))`;
    output.style.left = `calc(${left} * var(--figma-unit))`;

    svg.style.width = `calc(${OUTPUT_W} * var(--figma-unit))`;
    svg.style.height = `calc(${vb.height * scale} * var(--figma-unit))`;
    svg.style.marginLeft = `calc(${-padLeft * scale} * var(--figma-unit))`;
    svg.style.marginTop = `calc(${-padTop * scale} * var(--figma-unit))`;
  }

  function syncCardLayout(closeBtn, body, output) {
    syncCloseToName(closeBtn);
    if (output) syncOutputInkBox(body, output);
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

  function renderBody(memory) {
    const body = document.createElement('p');
    body.className = 'archive-card-body';
    const segments = memory?.bodySegments;
    if (Array.isArray(segments) && segments.length) {
      segments.forEach((seg) => {
        const span = document.createElement('span');
        span.className = 'archive-card-body-seg' + (seg.rep ? '' : ' is-muted');
        span.textContent = seg.text ?? '';
        body.appendChild(span);
      });
    } else {
      body.textContent = memory?.body || '';
    }
    return body;
  }

  function renderPictograms(memory) {
    const root = document.createElement('div');
    root.className = 'archive-card-pictograms';
    root.setAttribute('aria-hidden', 'true');

    const label = document.createElement('div');
    label.className = 'archive-card-bank-label';
    label.textContent = 'בנק פיקטוגרמות';
    root.appendChild(label);

    const sequence = memory?.sequence;
    if (Array.isArray(sequence) && sequence.length) {
      const seq = document.createElement('div');
      seq.className = 'archive-card-sequence';
      sequence.forEach((item) => {
        const host = document.createElement('div');
        host.className = 'archive-card-sequence-item';
        host.style.left = `calc(${item.x} * var(--figma-unit))`;
        host.style.width = `calc(${item.w} * var(--figma-unit))`;
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = '';
        img.draggable = false;
        host.appendChild(img);
        seq.appendChild(host);
      });
      root.appendChild(seq);
    }
    return root;
  }

  function bindBodyHover(card, body) {
    if (!card || !body) return;
    body.addEventListener('mouseenter', () => card.classList.add('is-text-hover'));
    body.addEventListener('mouseleave', () => card.classList.remove('is-text-hover'));
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

    const body = renderBody(memory);
    card.appendChild(body);
    bindBodyHover(card, body);

    const outputHost = document.createElement('div');
    outputHost.className = 'archive-card-output';
    card.appendChild(outputHost);

    if (Array.isArray(memory.sequence) && memory.sequence.length) {
      card.appendChild(renderPictograms(memory));
    }

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
    if (Array.isArray(memory.sequence)) {
      memory.sequence.forEach((item) => {
        if (!item?.src) return;
        const img = new Image();
        img.src = item.src;
      });
    }
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
