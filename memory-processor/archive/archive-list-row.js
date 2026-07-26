/**
 * Archive list-row — State 1 (idle) + State 2 (hover).
 *
 * State 1: name + empty brackets (compact pair on the right).
 * State 2 additive (atomic): number inside brackets on the left, icon, parameters.
 * Row does not move / grow / shift. Separators stay as State 1.
 */
(function (global) {
  const STYLE_ID = 'archive-list-row-styles';
  const svgCache = new Map();
  let hoverGen = 0;

  const STYLE_TEXT = `
.archive-memory-list{
  display:flex;flex-direction:column;align-items:flex-end;
  width:calc(1342 * var(--figma-unit));
  height:100%;overflow-x:hidden;overflow-y:auto;
  margin:calc(1 * var(--figma-unit)) 0 0;
  scrollbar-width:none
}
.archive-memory-list::-webkit-scrollbar{display:none}
.archive-memory-row{
  display:flex;align-items:flex-start;justify-content:flex-end;
  gap:calc(48 * var(--figma-unit));
  width:calc(1342 * var(--figma-unit));
  height:calc(114 * var(--figma-unit));
  padding-top:calc(4 * var(--figma-unit));
  margin-bottom:calc(-1 * var(--figma-unit));
  border:0;
  background-image:linear-gradient(#bbb,#bbb);
  background-size:100% 1px;
  background-position:bottom;
  background-repeat:no-repeat;
  box-sizing:border-box;
  color:#000;text-align:right;position:relative;
  font-family:var(--font-display);font-weight:600;
  font-size:calc(70 * var(--figma-unit));
  line-height:calc(110 * var(--figma-unit));
  cursor:default
}
.archive-memory-row.is-hoverable,
.archive-memory-row.is-openable{cursor:pointer}
.archive-memory-row:first-child{
  background-image:linear-gradient(#bbb,#bbb),linear-gradient(#bbb,#bbb);
  background-size:100% 1px,100% 1px;
  background-position:top,bottom
}
.archive-row-title{flex:1 0 0;min-width:0}
/* State 1 — compact empty pair on the right (Figma Parentheses 74 / gap 40) */
.archive-row-parens{
  display:flex;align-items:center;justify-content:flex-start;
  gap:calc(40 * var(--figma-unit));
  width:calc(74 * var(--figma-unit));
  flex-shrink:0;
  height:calc(110 * var(--figma-unit));
  pointer-events:none;user-select:none
}
.archive-paren-open,.archive-paren-close{
  flex:1 0 0;min-width:0;
  display:flex;align-items:center;justify-content:center;
  height:calc(110 * var(--figma-unit));
  font-family:var(--font-display);font-weight:600;
  font-size:calc(70 * var(--figma-unit));
  line-height:calc(110 * var(--figma-unit));
  color:#000
}
/* State 2 — [ + number on the left (Figma Hover Memory). Absolute: title does not shift. */
.archive-row-number-group{
  position:absolute;left:0;top:calc(4 * var(--figma-unit));z-index:2;
  display:flex;align-items:center;gap:calc(16 * var(--figma-unit));
  width:calc(163 * var(--figma-unit));
  height:calc(110 * var(--figma-unit));
  font-family:var(--font-display);font-weight:600;
  font-size:calc(70 * var(--figma-unit));
  line-height:calc(110 * var(--figma-unit));
  color:#000;white-space:nowrap;
  pointer-events:none;user-select:none;
  visibility:hidden
}
.archive-row-number-group .archive-paren-open-left{
  flex-shrink:0
}
.archive-row-number{flex-shrink:0}
/* Reveal: number+left bracket; right-side "[" hides (space kept so "]" does not move) */
.archive-memory-row.is-hover-revealed .archive-row-number-group{visibility:visible}
.archive-memory-row.is-hover-revealed .archive-row-parens .archive-paren-open{visibility:hidden}
/* Figma Hover Memory — black 2px top + bottom outline (with the atomic reveal) */
.archive-memory-row.is-hover-revealed{
  background-image:linear-gradient(#000,#000),linear-gradient(#000,#000);
  background-size:100% 2px,100% 2px;
  background-position:top,bottom
}
/* Card open — list rules off only (title geometry unchanged — list row stays put) */
.archive-memory-row.is-open,
.archive-memory-row.is-open.is-hover-revealed,
.archive-memory-row.is-open:first-child{
  background-image:none
}
/* Hover stage — 1920 frame coords (icon + parameters).
   Must never capture clicks: it sits above the list (z-index 25). */
.archive-list-hover-layer,
.archive-list-hover-layer.is-visible,
.archive-list-hover-layer *{
  pointer-events:none !important
}
.archive-list-hover-layer{
  position:absolute;
  left:calc(-1 * var(--archive-content-left) * var(--figma-unit));
  top:calc(-119 * var(--figma-unit));
  width:calc(1920 * var(--figma-unit));
  height:calc(1080 * var(--figma-unit));
  display:none;z-index:25;overflow:visible
}
.archive-list-hover-layer.is-visible{display:block}
.archive-list-hover-icon{
  position:absolute;right:calc(83 * var(--figma-unit));top:0;
  line-height:0;overflow:visible;width:fit-content;height:fit-content
}
.archive-list-hover-icon svg{
  display:block
}
@media(max-width:760px){
  .archive-memory-list{width:100%;height:100%}
  .archive-memory-row{
    width:100%;height:auto;font-size:28px;line-height:44px;gap:16px;margin-bottom:0
  }
  .archive-row-parens{width:48px;gap:16px;height:auto}
  .archive-paren-open,.archive-paren-close{height:auto;font-size:28px;line-height:44px}
  .archive-row-number-group{position:static;width:auto;height:auto;font-size:28px;line-height:44px}
  .archive-list-hover-layer.is-visible{
    position:static;display:flex;flex-direction:column;align-items:flex-end;gap:16px;margin-top:24px;
    width:auto;height:auto;left:auto;top:auto
  }
  .archive-list-hover-icon{position:static;width:auto;height:auto;right:auto}
}
`;

  function ensureStyles() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    // Always refresh — otherwise a stale injected tag can keep pointer-events:auto
    // on the hover overlay and swallow row clicks.
    if (style.textContent !== STYLE_TEXT) style.textContent = STYLE_TEXT;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Memories with params can enter State 2. */
  function canHover(memory) {
    return memory != null
      && memory.frequency != null
      && memory.clarity != null
      && memory.impact != null;
  }

  /** Memories with icon + output can open State 3. Missing assets are reported, never silent. */
  function missingOpenAssets(memory) {
    const missing = [];
    if (!memory?.icon) missing.push('icon');
    if (!memory?.output) missing.push('output');
    return missing;
  }

  function canOpen(memory) {
    return missingOpenAssets(memory).length === 0;
  }

  function reportMissingOpenAssets(memory, missing) {
    const id = memory?.id || '?';
    console.error(
      `[archive] memory ${id} cannot open — missing asset(s): ${missing.join(', ')}`,
      { id, icon: memory?.icon ?? null, output: memory?.output ?? null }
    );
  }

  /**
   * Inline an SVG 1:1 from its width/height attributes (Figma export size).
   * No scale, transform, ink fitting, or stroke adjustment.
   */
  async function loadInlineSvg(src) {
    if (svgCache.has(src)) return svgCache.get(src).cloneNode(true);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`svg ${src}: ${res.status}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error(`svg ${src}: not an svg`);
    svg.removeAttribute('style');
    svg.style.removeProperty('max-width');
    svg.style.removeProperty('max-height');
    svg.style.removeProperty('transform');
    const w = parseFloat(svg.getAttribute('width'));
    const h = parseFloat(svg.getAttribute('height'));
    if (!(w > 0) || !(h > 0)) {
      console.error(
        `[archive] ${src} missing width/height — export at final screen size from Figma`
      );
    } else {
      svg.style.width = `calc(${w} * var(--figma-unit))`;
      svg.style.height = `calc(${h} * var(--figma-unit))`;
    }
    svg.setAttribute('data-archive-src', src);
    svg.setAttribute('aria-hidden', 'true');
    svgCache.set(src, svg);
    return svg.cloneNode(true);
  }

  function create(memory, handlers = {}) {
    ensureStyles();
    const row = document.createElement('div');
    row.className = 'archive-memory-row';
    if (canHover(memory)) row.classList.add('is-hoverable');
    if (canOpen(memory)) row.classList.add('is-openable');
    row.setAttribute('role', 'listitem');
    row.dataset.id = memory.id;
    row.innerHTML = `
      <div class="archive-row-number-group" aria-hidden="true">
        <span class="archive-paren-open-left">[</span>
        <span class="archive-row-number">${escapeHtml(memory.id)}</span>
      </div>
      <div class="archive-row-title">${escapeHtml(memory.name)}</div>
      <div class="archive-row-parens" aria-hidden="true">
        <span class="archive-paren-open">[</span>
        <span class="archive-paren-close">]</span>
      </div>`;
    if (canHover(memory)) {
      row.addEventListener('mouseenter', () => {
        document.querySelectorAll('.archive-memory-row.is-hovered').forEach((el) => {
          if (el !== row) el.classList.remove('is-hovered', 'is-hover-revealed');
        });
        row.classList.add('is-hovered');
        handlers.onHover?.(memory, row);
      });
    }
    row.addEventListener('click', () => {
      const missing = missingOpenAssets(memory);
      if (missing.length) {
        reportMissingOpenAssets(memory, missing);
        return;
      }
      if (!handlers.onOpen) {
        console.error(`[archive] memory ${memory.id} click: onOpen handler missing`);
        return;
      }
      handlers.onOpen(memory, row);
    });
    return row;
  }

  function ensureParams(memory, layerEl) {
    const render = global.ArchiveCard?.renderParameters;
    if (!render || !layerEl || !memory) return null;
    let params = layerEl.querySelector('.archive-card-params');
    if (params && params.dataset.memoryId === memory.id) return params;
    const next = render(memory);
    if (params) params.replaceWith(next);
    else layerEl.appendChild(next);
    return next;
  }

  function ensureIconHost(layerEl) {
    let iconHost = layerEl.querySelector('.archive-list-hover-icon');
    if (!iconHost) {
      iconHost = document.createElement('div');
      iconHost.className = 'archive-list-hover-icon';
      layerEl.appendChild(iconHost);
    }
    return iconHost;
  }

  function revealHover(memory, layerEl, row) {
    if (row) row.classList.add('is-hover-revealed');
    layerEl.classList.add('is-visible');
    layerEl.setAttribute('aria-hidden', 'false');
    layerEl.dataset.memoryId = memory.id;
  }

  /**
   * Atomic State 2: number + icon + params together.
   * Waits for icon when uncached; on icon failure still reveals number + params.
   */
  async function showHoverIcon(memory, layerEl, row) {
    ensureStyles();
    global.ArchiveCard?.ensureStyles?.();
    const token = ++hoverGen;

    if (!layerEl || !memory || !canHover(memory)) {
      clearHoverIcon(layerEl);
      return;
    }

    const src = memory.icon || null;
    const iconCached = !!(src && svgCache.has(src));
    const sameMemoryReady =
      layerEl.dataset.memoryId === memory.id &&
      layerEl.classList.contains('is-visible') &&
      row?.classList.contains('is-hover-revealed');

    if (sameMemoryReady) {
      ensureParams(memory, layerEl);
      return;
    }

    document.querySelectorAll('.archive-memory-row.is-hover-revealed').forEach((el) => {
      if (el !== row) el.classList.remove('is-hover-revealed');
    });

    if (!iconCached && src) {
      layerEl.classList.remove('is-visible');
      layerEl.setAttribute('aria-hidden', 'true');
      if (row) row.classList.remove('is-hover-revealed');
    }

    ensureParams(memory, layerEl);

    const iconHost = ensureIconHost(layerEl);
    if (src && memory.iconTop != null) {
      iconHost.style.top = `calc(${Number(memory.iconTop)} * var(--figma-unit))`;
      const existing = iconHost.querySelector('svg[data-archive-src]');
      if (!existing || existing.getAttribute('data-archive-src') !== src) {
        if (iconCached) {
          iconHost.replaceChildren(svgCache.get(src).cloneNode(true));
        } else {
          iconHost.setAttribute('data-pending', src);
          try {
            const svg = await loadInlineSvg(src);
            if (token !== hoverGen || iconHost.getAttribute('data-pending') !== src) return;
            iconHost.replaceChildren(svg);
            iconHost.removeAttribute('data-pending');
          } catch (err) {
            console.warn('[archive] icon svg failed', src, err);
            if (iconHost.getAttribute('data-pending') === src) {
              iconHost.replaceChildren();
              iconHost.removeAttribute('data-pending');
            }
          }
        }
      }
    } else {
      iconHost.replaceChildren();
      iconHost.style.top = '';
    }

    if (token !== hoverGen) return;
    if (row && !row.classList.contains('is-hovered')) return;

    revealHover(memory, layerEl, row);
  }

  function clearHoverIcon(layerEl) {
    hoverGen += 1;
    if (!layerEl) return;
    layerEl.classList.remove('is-visible');
    layerEl.setAttribute('aria-hidden', 'true');
    delete layerEl.dataset.memoryId;
    const iconHost = layerEl.querySelector('.archive-list-hover-icon');
    if (iconHost) {
      iconHost.replaceChildren();
      iconHost.style.top = '';
      iconHost.removeAttribute('data-pending');
    }
    layerEl.querySelector('.archive-card-params')?.remove();
  }

  function preload(memory) {
    if (memory?.icon) loadInlineSvg(memory.icon).catch(() => {});
  }

  global.ArchiveListRow = {
    ensureStyles,
    create,
    showHoverIcon,
    clearHoverIcon,
    preload,
    loadInlineSvg,
    canHover,
    canOpen,
    missingOpenAssets,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
