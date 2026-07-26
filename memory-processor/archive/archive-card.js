/**
 * Archive card — new elements only (fade in on open).
 * Shared across hover→card (same DOM, never remounted here):
 *   number, name, brackets, icon, parameters — owned by the list row / hover layer.
 */
(function (global) {
  const STYLE_ID = 'archive-card-styles';
  const PARAM_LABELS = [
    { key: 'frequency', label: 'תדירות הזיכרון' },
    { key: 'clarity', label: 'בהירות הזיכרון' },
    { key: 'impact', label: 'השפעת הזיכרון' },
  ];

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.archive-card{
  position:relative;width:100%;height:100%;overflow:visible;pointer-events:none
}
.archive-card > *{pointer-events:auto}
.archive-card-close{
  position:absolute;z-index:4;border:0;background:transparent;padding:0;margin:0;cursor:pointer;appearance:none;
  left:calc(1341.8 * var(--figma-unit));
  top:calc(156.51171875 * var(--figma-unit));
  width:calc(38.976 * var(--figma-unit));
  height:calc(38.976 * var(--figma-unit));
  display:flex;align-items:center;justify-content:center;
  font-family:var(--font-display);font-weight:600;
  font-size:calc(70 * var(--figma-unit));line-height:1;color:#000
}
.archive-card-close:hover{color:#462203}
.archive-card-body{
  position:absolute;
  left:calc(675.864 * var(--figma-unit));
  top:calc(379.828 * var(--figma-unit));
  width:calc(547 * var(--figma-unit));
  margin:0;padding:0;
  font-family:var(--font-display);font-weight:600;font-size:calc(22 * var(--figma-unit));
  line-height:calc(25 * var(--figma-unit));color:#000;text-align:right;direction:rtl;
  z-index:2
}
.archive-card-source{
  position:absolute;
  left:calc(1124.1 * var(--figma-unit));
  top:calc(298 * var(--figma-unit));
  display:flex;align-items:center;justify-content:flex-start;gap:calc(16 * var(--figma-unit));
  font-family:var(--font-mono);font-size:calc(18 * var(--figma-unit));
  line-height:calc(19 * var(--figma-unit));color:#000;text-align:right;z-index:2
}
.archive-card-source-value{white-space:nowrap}
.archive-card-source-label{white-space:nowrap}
.archive-card-output{
  /* Bottom aligns with params (y:931); right edge meets params left (x:1586.99) */
  position:absolute;
  right:calc((1920 - 1586.986328125) * var(--figma-unit));
  bottom:calc((1080 - 931) * var(--figma-unit));
  top:auto;line-height:0;z-index:2;overflow:visible
}
.archive-card-output svg{display:block;max-width:none;max-height:none}
/* Shared params — hosted in the list hover layer (1920 frame coords). */
.archive-card-params{
  position:absolute;
  left:calc(1586.986328125 * var(--figma-unit));
  top:calc(810 * var(--figma-unit));
  width:calc(251.013916015625 * var(--figma-unit));
  height:calc(121 * var(--figma-unit));
  display:flex;flex-direction:column;align-items:stretch;gap:calc(32 * var(--figma-unit));
  font-family:var(--font-mono);font-size:calc(18 * var(--figma-unit));
  line-height:calc(19 * var(--figma-unit));color:#000;text-align:right;z-index:2;
  pointer-events:none
}
.archive-card-param{
  display:flex;align-items:center;justify-content:flex-start;gap:calc(30 * var(--figma-unit));
  width:100%;height:calc(19 * var(--figma-unit));flex-shrink:0
}
.archive-card-param-value{
  width:calc(44.7265625 * var(--figma-unit));flex-shrink:0;text-align:right;white-space:nowrap;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit));
  display:flex;align-items:center;justify-content:flex-end;height:100%;
  padding-top:calc(4 * var(--figma-unit));box-sizing:border-box
}
.archive-card-param-label{
  width:calc(176.287353515625 * var(--figma-unit));flex-shrink:0;text-align:right;
  font-size:calc(18 * var(--figma-unit));line-height:calc(19 * var(--figma-unit));
  display:flex;align-items:center;justify-content:flex-end;height:100%
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
    position:static;width:auto;max-width:100%;left:auto;right:auto;top:auto
  }
  .archive-card-close{position:absolute;right:16px;top:16px;left:auto}
  .archive-card-nav{display:none}
}
`;
    document.head.appendChild(style);
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

  /** Read-only generator parameters (frequency / clarity / impact). Shared hover/card DOM. */
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
    if (!host) return;
    if (!src) {
      host.replaceChildren();
      return;
    }
    const loader = global.ArchiveListRow?.loadInlineSvg;
    if (!loader) {
      console.warn('[archive] svg loader missing');
      return;
    }
    host.setAttribute('data-pending', src);
    try {
      const svg = await loader(src);
      if (host.getAttribute('data-pending') !== src) return;
      host.replaceChildren(svg);
      host.removeAttribute('data-pending');
    } catch (err) {
      console.warn('[archive] svg failed', src, err);
      if (host.getAttribute('data-pending') === src) {
        host.replaceChildren();
        host.removeAttribute('data-pending');
      }
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
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => handlers.onClose?.(memory));
    card.appendChild(closeBtn);

    const source = document.createElement('div');
    source.className = 'archive-card-source';
    source.innerHTML = `
      <span class="archive-card-source-value">${escapeHtml(memory.source)}</span>
      <span class="archive-card-source-label">מקור הזיכרון</span>`;
    card.appendChild(source);

    const body = document.createElement('p');
    body.className = 'archive-card-body';
    body.textContent = memory.body || '';
    card.appendChild(body);

    const outputHost = document.createElement('div');
    outputHost.className = 'archive-card-output';
    card.appendChild(outputHost);
    mountSvg(outputHost, memory.output);

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
    return card;
  }

  function clear(host) {
    if (host) host.replaceChildren();
  }

  function preload(memory) {
    const loader = global.ArchiveListRow?.loadInlineSvg;
    if (!loader || !memory) return;
    if (memory.icon) loader(memory.icon).catch(() => {});
    if (memory.output) loader(memory.output).catch(() => {});
  }

  global.ArchiveCard = {
    ensureStyles,
    mount,
    clear,
    preload,
    renderParameters,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
