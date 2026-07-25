/**
 * Pictogram SVG normalizer.
 *
 * External icons are fit once into the bank coordinate system (48-tall canvas):
 *   1. Measure glyph bbox including stroke
 *   2. Uniform scale so max(w,h) = 42
 *   3. stroke-width = 1/scale (effective stroke = 1), round caps/joins
 *   4. Canvas height 48; width = content + 3 each side; content 3 from bottom/L/R
 *
 * Bank files already use that grammar and are left geometrically intact.
 * Legacy helper normalizePictogramSvg (64 / stroke 0.25) remains for older callers.
 */
(function (root) {
  const SIZE = 64;
  const STROKE_WIDTH = '0.25';
  const STROKE_COLOR = '#000000';
  const FILL = 'none';
  const GRAPHIC_TAGS = 'path,rect,circle,ellipse,line,polyline,polygon';

  const BANK_HEIGHT = 48;
  const CONTENT_MAX = 42;
  const MARGIN = 3;
  const BANK_MARKER = 'data-pgmr-bank';

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function setOrReplaceAttr(openTag, name, value) {
    const re = new RegExp(`(\\s)${name}\\s*=\\s*["'][^"']*["']`, 'i');
    if (re.test(openTag)) return openTag.replace(re, `$1${name}="${escapeAttr(value)}"`);
    return openTag.replace(/>$/, ` ${name}="${escapeAttr(value)}">`);
  }

  function removeAttr(openTag, name) {
    return openTag
      .replace(new RegExp(`\\s${name}\\s*=\\s*["'][^"']*["']`, 'gi'), '')
      .replace(new RegExp(`\\s${name}\\s*=\\s*[^\\s>]+`, 'gi'), '');
  }

  function formatNum(n) {
    if (!Number.isFinite(n)) return '0';
    const r = Math.round(n * 1e6) / 1e6;
    return String(r);
  }

  function rewriteInlineStyle(styleValue) {
    const parts = String(styleValue || '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    const map = {};
    for (const part of parts) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).trim().toLowerCase();
      const val = part.slice(idx + 1).trim();
      map[key] = val;
    }
    map.fill = FILL;
    map.stroke = STROKE_COLOR;
    map['stroke-width'] = STROKE_WIDTH;
    return Object.entries(map)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function normalizeGraphicOpenTag(openTag) {
    let t = openTag;
    t = setOrReplaceAttr(t, 'fill', FILL);
    t = setOrReplaceAttr(t, 'stroke', STROKE_COLOR);
    t = setOrReplaceAttr(t, 'stroke-width', STROKE_WIDTH);
    const styleMatch = t.match(/\sstyle\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) {
      const rewritten = rewriteInlineStyle(styleMatch[1]);
      t = setOrReplaceAttr(t, 'style', rewritten);
    }
    return t;
  }

  function normalizeGraphics(html) {
    const tags = GRAPHIC_TAGS.split(',');
    let out = html;
    for (const tag of tags) {
      const re = new RegExp(`<${tag}\\b([^>]*?)(/?)>`, 'gi');
      out = out.replace(re, (full, attrs, selfClose) => {
        let open = normalizeGraphicOpenTag(`<${tag}${attrs}>`);
        if (selfClose === '/') open = open.replace(/>$/, '/>');
        return open;
      });
    }
    return out;
  }

  function normalizeCssDeclarations(body) {
    const decls = String(body || '')
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);
    const map = {};
    for (const part of decls) {
      const idx = part.indexOf(':');
      if (idx < 0) continue;
      const key = part.slice(0, idx).trim().toLowerCase();
      const val = part.slice(idx + 1).trim();
      map[key] = val;
    }
    if ('stroke' in map || 'stroke-width' in map || 'fill' in map) {
      map.fill = FILL;
      map.stroke = STROKE_COLOR;
      map['stroke-width'] = STROKE_WIDTH;
    }
    return Object.entries(map)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function normalizeStyleBlocks(html) {
    return String(html || '').replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
      const rewritten = String(css).replace(/\{([^}]*)\}/g, (_, body) => `{${normalizeCssDeclarations(body)}}`);
      return `<style${attrs}>${rewritten}</style>`;
    });
  }

  /** Strip BOM / XML declaration / doctype so bank files starting with <?xml normalize correctly. */
  function stripSvgProlog(svgText) {
    return String(svgText || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .replace(/^<\?xml\b[^?]*\?>\s*/i, '')
      .replace(/^<!DOCTYPE\b[^>]*>\s*/i, '')
      .trim();
  }

  function normalizeRootSvg(svgText) {
    const trimmed = stripSvgProlog(svgText);
    if (!/^<svg\b/i.test(trimmed)) return trimmed;

    return trimmed.replace(/^<svg([^>]*)>/i, (match, attrs) => {
      let a = attrs;
      a = a.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '');
      a = a.replace(/\s(?:width|height)\s*=\s*[^\s>]+/gi, '');
      if (!/\bviewBox\s*=/i.test(a)) {
        a += ` viewBox="0 0 ${SIZE} ${SIZE}"`;
      }
      return `<svg width="${SIZE}" height="${SIZE}"${a}>`;
    });
  }

  /**
   * Legacy normalize: size 64, stroke 0.25, color #000000.
   * @param {string} svgText
   * @returns {string}
   */
  function normalizePictogramSvg(svgText) {
    const trimmed = stripSvgProlog(svgText);
    if (!trimmed || !/^<svg\b/i.test(trimmed)) return trimmed;

    let out = normalizeRootSvg(trimmed);
    out = normalizeStyleBlocks(out);
    out = normalizeGraphics(out);
    return out;
  }

  function parseViewBox(svgText) {
    const m = String(svgText || '').match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    if (!m) return null;
    const parts = m[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length < 4 || parts.some((n) => !Number.isFinite(n))) return null;
    return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  }

  function parseRootSize(svgText) {
    const open = String(svgText || '').match(/^<svg\b([^>]*)>/i);
    if (!open) return { width: null, height: null };
    const w = parseFloat((open[1].match(/\bwidth\s*=\s*["']([^"']+)["']/i) || [])[1]);
    const h = parseFloat((open[1].match(/\bheight\s*=\s*["']([^"']+)["']/i) || [])[1]);
    return {
      width: Number.isFinite(w) && w > 0 ? w : null,
      height: Number.isFinite(h) && h > 0 ? h : null,
    };
  }

  /** True when SVG is already in the bank 48-tall canvas grammar. */
  function isBankCanvasSvg(svgText) {
    const trimmed = stripSvgProlog(svgText);
    if (!trimmed || !/^<svg\b/i.test(trimmed)) return false;
    if (new RegExp(`\\b${BANK_MARKER}\\s*=\\s*["']1["']`, 'i').test(trimmed)) return true;
    const vb = parseViewBox(trimmed);
    if (!vb || Math.abs(vb.height - BANK_HEIGHT) > 0.051) return false;
    // Old 64×64 display wrapper around a 48 viewBox is not a finished bank master.
    const root = parseRootSize(trimmed);
    if (root.width === SIZE && root.height === SIZE) return false;
    return true;
  }

  function detectStrokeWidth(svgText) {
    const text = String(svgText || '');
    let max = 0;
    const attrRe = /\bstroke-width\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = attrRe.exec(text))) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
    const cssRe = /stroke-width\s*:\s*([0-9.]+)/gi;
    while ((m = cssRe.exec(text))) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max > 0 ? max : 0.25;
  }

  function extractSvgInner(svgText) {
    const trimmed = stripSvgProlog(svgText);
    const m = trimmed.match(/^<svg\b[^>]*>([\s\S]*)<\/svg\s*>$/i);
    return m ? m[1] : trimmed;
  }

  /** Drop per-element stroke-width so the bank scale-group stroke can control weight. */
  function stripStrokeWidthForBankFit(html) {
    let out = String(html || '');
    out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
      const rewritten = String(css).replace(/\{([^}]*)\}/g, (_, body) => {
        const decls = String(body || '')
          .split(';')
          .map((p) => p.trim())
          .filter(Boolean)
          .filter((part) => !/^stroke-width\s*:/i.test(part));
        const map = {};
        for (const part of decls) {
          const idx = part.indexOf(':');
          if (idx < 0) continue;
          map[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
        }
        map.fill = FILL;
        map.stroke = STROKE_COLOR;
        map['stroke-linecap'] = 'round';
        map['stroke-linejoin'] = 'round';
        const cssBody = Object.entries(map)
          .map(([k, v]) => `${k}:${v}`)
          .join(';');
        return `{${cssBody}}`;
      });
      return `<style${attrs}>${rewritten}</style>`;
    });

    const tags = GRAPHIC_TAGS.split(',');
    for (const tag of tags) {
      const re = new RegExp(`<${tag}\\b([^>]*?)(/?)>`, 'gi');
      out = out.replace(re, (full, attrs, selfClose) => {
        let open = `<${tag}${attrs}>`;
        open = removeAttr(open, 'stroke-width');
        open = setOrReplaceAttr(open, 'fill', FILL);
        open = setOrReplaceAttr(open, 'stroke', STROKE_COLOR);
        open = setOrReplaceAttr(open, 'stroke-linecap', 'round');
        open = setOrReplaceAttr(open, 'stroke-linejoin', 'round');
        const styleMatch = open.match(/\sstyle\s*=\s*["']([^"']*)["']/i);
        if (styleMatch) {
          const parts = String(styleMatch[1] || '')
            .split(';')
            .map((p) => p.trim())
            .filter(Boolean)
            .filter((part) => !/^stroke-width\s*:/i.test(part));
          const map = {};
          for (const part of parts) {
            const idx = part.indexOf(':');
            if (idx < 0) continue;
            map[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim();
          }
          map.fill = FILL;
          map.stroke = STROKE_COLOR;
          map['stroke-linecap'] = 'round';
          map['stroke-linejoin'] = 'round';
          open = setOrReplaceAttr(
            open,
            'style',
            Object.entries(map)
              .map(([k, v]) => `${k}:${v}`)
              .join(';')
          );
        }
        if (selfClose === '/') open = open.replace(/>$/, '/>');
        return open;
      });
    }

    // Bank-style wrapper groups may carry stroke-width; drop so the outer fit group owns it.
    out = out.replace(/<g\b([^>]*)>/gi, (full, attrs) => {
      let open = `<g${attrs}>`;
      open = removeAttr(open, 'stroke-width');
      return open;
    });
    return out;
  }

  function maxStrokeFromElement(el) {
    if (!el) return 0;
    let max = 0;
    const visit = (node) => {
      if (!node || node.nodeType !== 1) return;
      const attr = node.getAttribute && node.getAttribute('stroke-width');
      if (attr != null) {
        const n = parseFloat(attr);
        if (Number.isFinite(n) && n > max) max = n;
      }
      const style = node.getAttribute && node.getAttribute('style');
      if (style) {
        const m = /stroke-width\s*:\s*([0-9.]+)/i.exec(style);
        if (m) {
          const n = parseFloat(m[1]);
          if (Number.isFinite(n) && n > max) max = n;
        }
      }
      if (typeof getComputedStyle === 'function' && node.ownerDocument?.defaultView) {
        try {
          const cs = node.ownerDocument.defaultView.getComputedStyle(node);
          const n = parseFloat(cs.strokeWidth);
          if (Number.isFinite(n) && n > max) max = n;
        } catch (_) {
          /* ignore */
        }
      }
      Array.from(node.children || []).forEach(visit);
    };
    visit(el);
    return max;
  }

  function measureStrokeInclusiveBBox(svgText, options) {
    const opts = options || {};
    if (opts.bbox && Number.isFinite(opts.bbox.width) && Number.isFinite(opts.bbox.height)) {
      return {
        x: opts.bbox.x || 0,
        y: opts.bbox.y || 0,
        width: opts.bbox.width,
        height: opts.bbox.height,
        strokeWidth: opts.bbox.strokeWidth || detectStrokeWidth(svgText),
      };
    }
    if (typeof opts.measure === 'function') {
      const measured = opts.measure(svgText);
      if (measured && measured.width > 0 && measured.height > 0) return measured;
    }

    const docRef = opts.document || (typeof document !== 'undefined' ? document : null);
    const DOMParserCtor = opts.DOMParser || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    const strokeHint = detectStrokeWidth(svgText);

    if (docRef && DOMParserCtor) {
      const parser = new DOMParserCtor();
      const doc = parser.parseFromString(stripSvgProlog(svgText), 'image/svg+xml');
      const svg = doc.documentElement;
      if (svg && svg.nodeName.toLowerCase() === 'svg') {
        const mount = docRef.createElement('div');
        mount.style.cssText =
          'position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;visibility:hidden';
        let clone;
        try {
          clone = docRef.importNode ? docRef.importNode(svg, true) : null;
        } catch (_) {
          clone = null;
        }
        if (!clone) {
          const wrap = docRef.createElement('div');
          wrap.innerHTML = stripSvgProlog(svgText);
          clone = wrap.firstChild;
        }
        if (clone && docRef.body) {
          try {
            docRef.body.appendChild(mount);
            mount.appendChild(clone);
            let box = null;
            try {
              if (typeof clone.getBBox === 'function') {
                try {
                  box = clone.getBBox({ stroke: true, fill: true });
                } catch (_) {
                  box = clone.getBBox();
                  const sw = Math.max(strokeHint, maxStrokeFromElement(clone));
                  box = {
                    x: box.x - sw / 2,
                    y: box.y - sw / 2,
                    width: box.width + sw,
                    height: box.height + sw,
                  };
                }
              }
            } catch (_) {
              box = null;
            }
            const sw = Math.max(strokeHint, maxStrokeFromElement(clone));
            mount.remove();
            if (box && box.width > 0 && box.height > 0) {
              // If stroke:true worked, box already includes stroke; if we inflated manually too, fine.
              // When stroke:true unsupported we already inflated. Avoid double-inflate when
              // getBBox({stroke:true}) succeeded by checking whether width grew vs geometry-only.
              return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                strokeWidth: sw,
              };
            }
          } catch (_) {
            try {
              mount.remove();
            } catch (_) {
              /* ignore */
            }
          }
        }
      }
    }

    const vb = parseViewBox(svgText) || { x: 0, y: 0, width: SIZE, height: SIZE };
    return {
      x: vb.x - strokeHint / 2,
      y: vb.y - strokeHint / 2,
      width: vb.width + strokeHint,
      height: vb.height + strokeHint,
      strokeWidth: strokeHint,
    };
  }

  /**
   * Fit an external pictogram into the bank 48-tall canvas.
   * Idempotent for already-normalized / bank masters.
   */
  function normalizeExternalToBankCanvas(svgText, options) {
    const trimmed = stripSvgProlog(svgText);
    if (!trimmed || !/^<svg\b/i.test(trimmed)) return trimmed;
    if (isBankCanvasSvg(trimmed)) {
      // Ensure marker + explicit width/height from viewBox for display parity.
      return ensureBankRootAttrs(trimmed);
    }

    const innerRaw = extractSvgInner(trimmed);
    const graphicRe = new RegExp(`<(?:${GRAPHIC_TAGS.split(',').join('|')})\\b`, 'i');
    if (!graphicRe.test(innerRaw)) {
      // Placeholders / test doubles with no glyph geometry — stamp bank canvas, keep payload/ids.
      return ensureBankRootAttrs(
        trimmed.replace(/^<svg\b([^>]*)>/i, (match, attrs) => {
          let a = attrs;
          a = a.replace(/\s(?:width|height|viewBox)\s*=\s*["'][^"']*["']/gi, '');
          a = a.replace(/\s(?:width|height|viewBox)\s*=\s*[^\s>]+/gi, '');
          return `<svg width="${BANK_HEIGHT}" height="${BANK_HEIGHT}" viewBox="0 0 ${BANK_HEIGHT} ${BANK_HEIGHT}"${a}>`;
        })
      );
    }

    const bbox = measureStrokeInclusiveBBox(trimmed, options);
    const maxDim = Math.max(bbox.width, bbox.height);
    if (!(maxDim > 0)) return ensureBankRootAttrs(trimmed);

    const scaleFactor = CONTENT_MAX / maxDim;
    const contentW = bbox.width * scaleFactor;
    const contentH = bbox.height * scaleFactor;
    const canvasW = contentW + MARGIN * 2;
    const yTop = BANK_HEIGHT - MARGIN - contentH;
    const strokeWidth = 1 / scaleFactor;

    const inner = stripStrokeWidthForBankFit(innerRaw);
    const tx = MARGIN;
    const ty = yTop;
    const ox = bbox.x;
    const oy = bbox.y;

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ${BANK_MARKER}="1" ` +
      `width="${formatNum(canvasW)}" height="${BANK_HEIGHT}" ` +
      `viewBox="0 0 ${formatNum(canvasW)} ${BANK_HEIGHT}" overflow="hidden">` +
      `<g transform="translate(${formatNum(tx)},${formatNum(ty)}) scale(${formatNum(scaleFactor)}) ` +
      `translate(${formatNum(-ox)},${formatNum(-oy)})" ` +
      `fill="none" stroke="${STROKE_COLOR}" stroke-width="${formatNum(strokeWidth)}" ` +
      `stroke-linecap="round" stroke-linejoin="round">` +
      `${inner}` +
      `</g></svg>`
    );
  }

  function ensureBankRootAttrs(svgText) {
    const trimmed = stripSvgProlog(svgText);
    if (!/^<svg\b/i.test(trimmed)) return trimmed;
    const vb = parseViewBox(trimmed);
    const root = parseRootSize(trimmed);
    const width = root.width || (vb ? vb.width : BANK_HEIGHT);
    const height = root.height || (vb ? vb.height : BANK_HEIGHT);
    return trimmed.replace(/^<svg\b([^>]*)>/i, (match, attrs) => {
      let a = attrs;
      a = a.replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '');
      a = a.replace(/\s(?:width|height)\s*=\s*[^\s>]+/gi, '');
      if (!new RegExp(`\\b${BANK_MARKER}\\s*=`, 'i').test(a)) {
        a += ` ${BANK_MARKER}="1"`;
      }
      if (!/\bviewBox\s*=/i.test(a) && vb) {
        a += ` viewBox="0 0 ${formatNum(vb.width)} ${formatNum(vb.height)}"`;
      } else if (!/\bviewBox\s*=/i.test(a)) {
        a += ` viewBox="0 0 ${formatNum(width)} ${BANK_HEIGHT}"`;
      }
      if (!/\boverflow\s*=/i.test(a)) a += ' overflow="hidden"';
      return `<svg width="${formatNum(width)}" height="${formatNum(height)}"${a}>`;
    });
  }

  /**
   * Prepare a pictogram for cache/session use.
   * External sources are bank-fitted; bank masters keep geometry.
   */
  function preparePictogramSvg(svgText, options) {
    const opts = options || {};
    const source = String(opts.source || '');
    const trimmed = stripSvgProlog(svgText);
    if (!trimmed || !/^<svg\b/i.test(trimmed)) return trimmed;
    if (source === 'bank' || source === 'bank-fallback' || isBankCanvasSvg(trimmed)) {
      return ensureBankRootAttrs(trimmed);
    }
    return normalizeExternalToBankCanvas(trimmed, opts);
  }

  /** Display size helpers (bank canvas → screen). */
  const DISPLAY_HEIGHT_PX = 105;
  const DISPLAY_GAP_PX = 0.875;

  function bankDisplayGapUnits() {
    return (DISPLAY_GAP_PX * BANK_HEIGHT) / DISPLAY_HEIGHT_PX;
  }

  function readBankCanvasSize(svgText) {
    const trimmed = stripSvgProlog(svgText);
    const vb = parseViewBox(trimmed);
    const root = parseRootSize(trimmed);
    const height = BANK_HEIGHT;
    let width = root.width;
    if (!(width > 0) && vb) width = vb.width;
    if (!(width > 0)) width = BANK_HEIGHT;
    return { width, height, viewBox: vb };
  }

  const api = {
    SIZE,
    STROKE_WIDTH,
    STROKE_COLOR,
    FILL,
    BANK_HEIGHT,
    CONTENT_MAX,
    MARGIN,
    BANK_MARKER,
    DISPLAY_HEIGHT_PX,
    DISPLAY_GAP_PX,
    stripSvgProlog,
    normalizePictogramSvg,
    isBankCanvasSvg,
    normalizeExternalToBankCanvas,
    preparePictogramSvg,
    measureStrokeInclusiveBBox,
    bankDisplayGapUnits,
    readBankCanvasSize,
    ensureBankRootAttrs,
  };

  root.MemoryEngineNormalizePictogramSvg = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
