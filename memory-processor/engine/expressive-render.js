/**
 * Expressive Rendering Layer — deterministic SVG→SVG transform.
 * Applies memorySource / memoryFrequency / memoryClarity / memoryImpact
 * to a pictogram sequence. Identical params always produce identical output.
 */
(function (root) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';

  const FRAG_STRIPS = [1, 4, 4];
  const FRAG_DIST = [0, 18, 18];
  const DOT_CLEARANCE = 1.6;
  const BASE_STROKE = 0.5;
  const MAX_STROKE = 30;
  const STROKE_COLOR = '#000000';
  const GRAPHIC_SEL = 'path,rect,circle,ellipse,line,polyline,polygon';

  const DEFAULT_PARAMS = {
    memorySource: 0,
    memoryFrequency: 100,
    memoryClarity: 100,
    memoryImpact: 0,
  };

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function normalizeParams(params) {
    const p = { ...DEFAULT_PARAMS, ...(params || {}) };
    const num = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    return {
      memorySource: clamp(Math.round(num(p.memorySource, 0)), 0, 2),
      memoryFrequency: clamp(num(p.memoryFrequency, 100), 0, 100),
      memoryClarity: clamp(num(p.memoryClarity, 100), 0, 100),
      memoryImpact: clamp(num(p.memoryImpact, 0), 0, 100),
    };
  }

  function computeStrokeWidth(impact) {
    const v = clamp(Number(impact), 0, 100);
    return BASE_STROKE + (MAX_STROKE - BASE_STROKE) * (v / 100);
  }

  function computeDash(freq, strokeWidth) {
    const f100 = clamp(Number(freq), 0, 100);
    if (f100 === 100) return { solid: true, dasharray: null, dashoffset: 0 };
    const f = f100 / 100;
    const dash = Math.max(0.01, 12 * Math.pow(f, 1.6));
    const gap = Math.max(0.6 + 6.8 * (1 - f), DOT_CLEARANCE * (strokeWidth || BASE_STROKE));
    return {
      solid: false,
      dasharray: `${formatNum(dash)} ${formatNum(gap)}`,
      dashoffset: 0,
      dash,
      gap,
    };
  }

  function computeCollapseScale(clarity) {
    const c = clamp(Number(clarity), 0, 100) / 100;
    return 1 + (0.02 - 1) * (1 - c);
  }

  function fragOffset(level, groupIdx, stripIdx) {
    const lv = clamp(Math.round(Number(level) || 0), 0, 2);
    const dist = FRAG_DIST[lv] || 0;
    if (!dist) return 0;
    const startSign = groupIdx % 2 === 0 ? 1 : -1;
    const stripSign = stripIdx % 2 === 0 ? 1 : -1;
    return startSign * stripSign * dist;
  }

  function formatNum(n) {
    if (!Number.isFinite(n)) return '0';
    const r = Math.round(n * 1000) / 1000;
    return String(r);
  }

  function parseViewBox(vb) {
    const parts = String(vb || '0 0 0 0')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return {
      x: parts[0] || 0,
      y: parts[1] || 0,
      w: parts[2] || 0,
      h: parts[3] || 0,
    };
  }

  function parseTranslate(transform) {
    const m = String(transform || '').match(/translate\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/i);
    if (!m) return { x: 0, y: 0 };
    return { x: Number(m[1]) || 0, y: Number(m[2]) || 0 };
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  /** Extract balanced top-level child element strings from SVG root inner HTML. */
  function extractTopLevelElements(inner) {
    const out = [];
    let i = 0;
    const s = inner || '';
    while (i < s.length) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (i >= s.length) break;
      if (s[i] !== '<') break;
      if (s.startsWith('<!--', i)) {
        const end = s.indexOf('-->', i);
        i = end < 0 ? s.length : end + 3;
        continue;
      }
      const tagMatch = s.slice(i).match(/^<\/?([a-zA-Z][\w:-]*)/);
      if (!tagMatch) break;
      if (s[i + 1] === '/') break;
      const tag = tagMatch[1];
      const selfClose = (() => {
        let j = i + 1;
        let quote = null;
        while (j < s.length) {
          const c = s[j];
          if (quote) {
            if (c === quote) quote = null;
          } else if (c === '"' || c === "'") {
            quote = c;
          } else if (c === '>') {
            return s[j - 1] === '/';
          }
          j++;
        }
        return false;
      })();
      if (selfClose) {
        const gt = s.indexOf('>', i);
        out.push(s.slice(i, gt + 1));
        i = gt + 1;
        continue;
      }
      const openEnd = s.indexOf('>', i);
      if (openEnd < 0) break;
      let depth = 1;
      let j = openEnd + 1;
      while (j < s.length && depth > 0) {
        const nextOpen = s.indexOf(`<${tag}`, j);
        const nextClose = s.indexOf(`</${tag}`, j);
        if (nextClose < 0) {
          j = s.length;
          break;
        }
        if (nextOpen >= 0 && nextOpen < nextClose) {
          const after = s[nextOpen + tag.length + 1];
          if (after === '>' || after === ' ' || after === '/' || after === '\n' || after === '\t') {
            depth++;
            j = nextOpen + tag.length + 1;
            continue;
          }
          j = nextOpen + 1;
          continue;
        }
        depth--;
        if (depth === 0) {
          const closeEnd = s.indexOf('>', nextClose);
          out.push(s.slice(i, closeEnd + 1));
          i = closeEnd + 1;
          break;
        }
        j = nextClose + tag.length + 2;
      }
      if (depth > 0) break;
    }
    return out;
  }

  function unwrapRootInner(svgString) {
    const m = String(svgString || '')
      .trim()
      .match(/^<svg([^>]*)>([\s\S]*)<\/svg\s*>$/i);
    if (!m) return null;
    return { attrs: m[1], inner: m[2] };
  }

  function getAttr(attrs, name) {
    const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
    const m = String(attrs || '').match(re);
    return m ? m[1] : null;
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

  function normalizeGraphicOpenTag(openTag, strokeWidth, dash) {
    let t = openTag;
    t = setOrReplaceAttr(t, 'fill', 'none');
    t = setOrReplaceAttr(t, 'stroke', STROKE_COLOR);
    t = setOrReplaceAttr(t, 'stroke-width', formatNum(strokeWidth));
    t = setOrReplaceAttr(t, 'stroke-linecap', 'round');
    t = setOrReplaceAttr(t, 'stroke-linejoin', 'round');
    if (dash.solid) {
      t = removeAttr(t, 'stroke-dasharray');
      t = removeAttr(t, 'stroke-dashoffset');
    } else {
      t = setOrReplaceAttr(t, 'stroke-dasharray', dash.dasharray);
      t = setOrReplaceAttr(t, 'stroke-dashoffset', '0');
    }
    // Drop style= that could override our attrs
    t = removeAttr(t, 'style');
    return t;
  }

  /**
   * Bank / manual-upload SVGs often style via <style>.cls-1{…}.
   * CSS beats presentation attributes, so Impact/Frequency must rewrite
   * those declarations — otherwise stroke-width stays locked at 0.5.
   */
  function rewriteCssDeclarationsForExpressive(body, strokeWidth, dash) {
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
    const touchesStroke =
      'stroke' in map ||
      'stroke-width' in map ||
      'fill' in map ||
      'stroke-dasharray' in map ||
      'stroke-dashoffset' in map ||
      'stroke-linecap' in map ||
      'stroke-linejoin' in map;
    if (!touchesStroke) {
      return Object.entries(map)
        .map(([k, v]) => `${k}:${v}`)
        .join(';');
    }
    map.fill = 'none';
    map.stroke = STROKE_COLOR;
    map['stroke-width'] = formatNum(strokeWidth);
    map['stroke-linecap'] = 'round';
    map['stroke-linejoin'] = 'round';
    if (dash.solid) {
      delete map['stroke-dasharray'];
      delete map['stroke-dashoffset'];
    } else {
      map['stroke-dasharray'] = dash.dasharray;
      map['stroke-dashoffset'] = '0';
    }
    return Object.entries(map)
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function normalizeStyleBlocksInHtml(html, strokeWidth, dash) {
    return String(html || '').replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, css) => {
      const rewritten = String(css).replace(/\{([^}]*)\}/g, (_, body) => {
        return `{${rewriteCssDeclarationsForExpressive(body, strokeWidth, dash)}}`;
      });
      return `<style${attrs}>${rewritten}</style>`;
    });
  }

  function normalizeGraphicsInHtml(html, strokeWidth, dash) {
    let out = normalizeStyleBlocksInHtml(html, strokeWidth, dash);
    const tags = GRAPHIC_SEL.split(',');
    for (const tag of tags) {
      const re = new RegExp(`<${tag}\\b([^>]*?)(/?)>`, 'gi');
      out = out.replace(re, (full, attrs, selfClose) => {
        let open = normalizeGraphicOpenTag(`<${tag}${attrs}>`, strokeWidth, dash);
        if (selfClose === '/') open = open.replace(/>$/, '/>');
        return open;
      });
    }
    return out;
  }

  function parsePictogramElement(elHtml, fallbackSize) {
    const openMatch = elHtml.match(/^<([a-zA-Z][\w:-]*)([^>]*)>/);
    if (!openMatch) return null;
    const tag = openMatch[1].toLowerCase();
    const attrs = openMatch[2];
    const transform = getAttr(attrs, 'transform') || '';
    const { x, y } = parseTranslate(transform);
    const size = fallbackSize || 64;
    // Prefer nested svg width/height if present
    const nested = elHtml.match(/<svg\b([^>]*)>/i);
    let w = size;
    let h = size;
    if (nested) {
      const nw = parseFloat(getAttr(nested[1], 'width'));
      const nh = parseFloat(getAttr(nested[1], 'height'));
      if (Number.isFinite(nw) && nw > 0) w = nw;
      if (Number.isFinite(nh) && nh > 0) h = nh;
    }
    return {
      html: elHtml,
      tag,
      attrs,
      x,
      y,
      width: w,
      height: h,
      bbox: { x, y, width: w, height: h },
    };
  }

  function resolvePictograms(svgString, options) {
    const root = unwrapRootInner(svgString);
    if (!root) return { viewBox: { x: 0, y: 0, w: 0, h: 0 }, pictograms: [] };
    const vb = parseViewBox(getAttr(root.attrs, 'viewBox') || '0 0 0 0');
    let children = extractTopLevelElements(root.inner);

    // Single wrapper <g>: treat its children as pictograms, bake wrapper transform
    if (children.length === 1) {
      const only = children[0];
      const om = only.match(/^<g\b([^>]*)>([\s\S]*)<\/g\s*>$/i);
      if (om) {
        const wrapT = parseTranslate(getAttr(om[1], 'transform') || '');
        const innerKids = extractTopLevelElements(om[2]);
        if (innerKids.length > 1 || (innerKids.length === 1 && !/^<svg\b/i.test(innerKids[0]))) {
          children = innerKids.map((kid) => {
            const p = parsePictogramElement(kid, 64);
            if (!p) return kid;
            const nx = p.x + wrapT.x;
            const ny = p.y + wrapT.y;
            const baked = kid.replace(/^<([a-zA-Z][\w:-]*)([^>]*)>/, (full, tag, attrs) => {
              let a = attrs;
              if (/\btransform\s*=/i.test(a)) {
                a = a.replace(/\btransform\s*=\s*["'][^"']*["']/i, ` transform="translate(${formatNum(nx)},${formatNum(ny)})"`);
              } else {
                a += ` transform="translate(${formatNum(nx)},${formatNum(ny)})"`;
              }
              return `<${tag}${a}>`;
            });
            return baked;
          });
        }
      }
    }

    const pictograms = children
      .map((html, i) => {
        const p = parsePictogramElement(html, 64);
        if (!p) return null;
        if (options && options.metrics && options.metrics[i]) {
          const m = options.metrics[i];
          // Metrics refine content bbox (for clarity centers). Keep layout
          // slot origin from the sequence translate for placement.
          p.bbox = {
            x: m.x != null ? m.x : p.x,
            y: m.y != null ? m.y : p.y,
            width: m.width != null ? m.width : p.width,
            height: m.height != null ? m.height : p.height,
          };
        }
        return p;
      })
      .filter(Boolean);

    return { viewBox: vb, pictograms, rootAttrs: root.attrs };
  }

  function measureWithDom(svgString, options) {
    const DOMParserCtor = (options && options.DOMParser) || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    const docRef = (options && options.document) || (typeof document !== 'undefined' ? document : null);
    if (!DOMParserCtor || !docRef) return null;

    const parser = new DOMParserCtor();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;

    const mount = docRef.createElement('div');
    mount.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;visibility:hidden';
    const clone = docRef.importNode
      ? docRef.importNode(svg, true)
      : (() => {
          const wrap = docRef.createElement('div');
          wrap.innerHTML = new XMLSerializer().serializeToString(svg);
          return wrap.firstChild;
        })();
    try {
      docRef.body.appendChild(mount);
      mount.appendChild(clone);
    } catch (_) {
      // Node / no body — skip DOM measure
      return null;
    }

    let nodes = Array.from(clone.children);
    if (nodes.length === 1 && nodes[0].tagName && nodes[0].tagName.toLowerCase() === 'g') {
      const wrap = nodes[0];
      const kids = Array.from(wrap.children);
      if (kids.length > 1) nodes = kids;
    }

    const metrics = nodes.map((node) => {
      try {
        const b = node.getBBox();
        // getBBox is in the element's local space (own transform ignored).
        // Add translate so metrics are in root/user coordinates.
        const t = parseTranslate(node.getAttribute && node.getAttribute('transform'));
        return {
          x: t.x + b.x,
          y: t.y + b.y,
          width: b.width,
          height: b.height,
        };
      } catch (_) {
        return null;
      }
    });
    mount.remove();
    if (metrics.some((m) => !m)) return null;
    return metrics;
  }

  function stripClipRects(localBBox, level, padExtra) {
    const strips = FRAG_STRIPS[level] || 1;
    const rects = [];
    const { width, height } = localBBox;
    const ext = padExtra || 0;
    if (level === 0 || strips <= 1) {
      rects.push({ x: -ext, y: -ext, width: width + ext * 2, height: height + ext * 2 });
      return rects;
    }
    if (level === 1) {
      // Horizontal bands — cut on y, slide on x. Extend on perpendicular axis (x)
      const bandH = height / strips;
      for (let i = 0; i < strips; i++) {
        const y = i * bandH;
        const h = i === strips - 1 ? height - y : bandH;
        rects.push({ x: -ext, y, width: width + ext * 2, height: h });
      }
    } else {
      // Vertical columns — cut on x, slide on y. Extend on perpendicular axis (y)
      const colW = width / strips;
      for (let i = 0; i < strips; i++) {
        const x = i * colW;
        const w = i === strips - 1 ? width - x : colW;
        rects.push({ x, y: -ext, width: w, height: height + ext * 2 });
      }
    }
    return rects;
  }

  function localMasterHtml(p) {
    // Master stored in local coords (0,0)-(w,h) matching nested svg size
    const nested = p.html.match(/^<g\b[^>]*>([\s\S]*)<\/g\s*>$/i);
    if (nested) {
      const inner = nested[1].trim();
      const svgM = inner.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg\s*>$/i);
      if (svgM) {
        // Keep svg as-is at local origin
        return inner;
      }
      return inner;
    }
    // Non-group: strip translate from outer
    return p.html.replace(/\stransform\s*=\s*["'][^"']*["']/i, '');
  }

  function applyExpressiveRendering(svgString, params, options) {
    const opts = options || {};
    const p = normalizeParams(params);
    const level = p.memorySource;
    const strokeWidth = computeStrokeWidth(p.memoryImpact);
    const dash = computeDash(p.memoryFrequency, strokeWidth);
    const collapseScale = computeCollapseScale(p.memoryClarity);
    const stripsPer = FRAG_STRIPS[level] || 1;
    const maxFrag = FRAG_DIST[level] || 0;

    let metrics = opts.metrics || null;
    if (!metrics) {
      metrics = measureWithDom(svgString, opts);
    }

    const resolved = resolvePictograms(svgString, metrics ? { metrics } : opts);
    const { viewBox, pictograms } = resolved;
    const N = pictograms.length;

    // Clarity centers from bboxes
    let seqCenter = 0;
    if (N > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (const pic of pictograms) {
        minX = Math.min(minX, pic.bbox.x);
        maxX = Math.max(maxX, pic.bbox.x + pic.bbox.width);
      }
      seqCenter = (minX + maxX) / 2;
    }

    const clarityDxList = pictograms.map((pic) => {
      if (N <= 1) return 0;
      const centerX = pic.bbox.x + pic.bbox.width / 2;
      const newCenterX = seqCenter + (centerX - seqCenter) * collapseScale;
      return newCenterX - centerX;
    });

    // Keep the viewBox stable across every parameter. Source changes may add
    // fragmentation, but must not resize the displayed pictogram sequence.
    const pad = Math.max(12, ...FRAG_DIST);
    let maxAbsClarity = 0;
    for (const d of clarityDxList) maxAbsClarity = Math.max(maxAbsClarity, Math.abs(d));

    const defsParts = [];
    const bodyParts = [];

    pictograms.forEach((pic, groupIdx) => {
      const clarityDx = clarityDxList[groupIdx] || 0;
      const masterId = `ex-master-${groupIdx}`;
      let masterHtml = localMasterHtml(pic);
      masterHtml = normalizeGraphicsInHtml(masterHtml, strokeWidth, dash);

      defsParts.push(`<g id="${masterId}">${masterHtml}</g>`);

      // Clips in local master coordinates (0..w, 0..h); cut piece moves with translate
      const localBBox = { x: 0, y: 0, width: pic.width, height: pic.height };
      const clipPad = Math.max(pad, maxFrag + MAX_STROKE * 1.2) + Math.abs(clarityDx) + 4;
      const clips = stripClipRects(localBBox, level, clipPad);

      const stripGroups = [];
      for (let stripIdx = 0; stripIdx < clips.length; stripIdx++) {
        const clip = clips[stripIdx];
        const clipId = `ex-clip-${groupIdx}-${stripIdx}`;
        const offset = fragOffset(level, groupIdx, stripIdx);
        defsParts.push(
          `<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">` +
            `<rect x="${formatNum(clip.x)}" y="${formatNum(clip.y)}" width="${formatNum(clip.width)}" height="${formatNum(clip.height)}"/>` +
            `</clipPath>`
        );

        let dx = 0;
        let dy = 0;
        if (level === 1) dx = offset;
        else if (level === 2) dy = offset;

        // Place at pictogram origin, clip locally, slide cut piece
        const useEl =
          `<g transform="translate(${formatNum(pic.x + dx)},${formatNum(pic.y + dy)})">` +
          `<g clip-path="url(#${clipId})">` +
          `<use href="#${masterId}" xlink:href="#${masterId}"/>` +
          `</g></g>`;
        stripGroups.push(useEl);
      }

      bodyParts.push(
        `<g transform="translate(${formatNum(clarityDx)},0)">${stripGroups.join('')}</g>`
      );
    });

    const outX = viewBox.x - pad;
    const outY = viewBox.y - pad;
    const outW = viewBox.w + pad * 2;
    const outH = viewBox.h + pad * 2;

    const svg =
      `<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" viewBox="${formatNum(outX)} ${formatNum(outY)} ${formatNum(outW)} ${formatNum(outH)}" overflow="visible">` +
      `<defs>${defsParts.join('')}</defs>` +
      bodyParts.join('') +
      `</svg>`;

    const state = {
      pictogramCount: N,
      stripsPerPictogram: stripsPer,
      maxOffset: maxFrag,
      dasharray: dash.solid ? 'solid' : dash.dasharray,
      strokeWidth,
      collapseScale,
      pad,
    };

    return { svg, state, params: p };
  }

  const api = {
    DEFAULT_PARAMS,
    FRAG_STRIPS,
    FRAG_DIST,
    DOT_CLEARANCE,
    BASE_STROKE,
    MAX_STROKE,
    normalizeParams,
    computeStrokeWidth,
    computeDash,
    computeCollapseScale,
    fragOffset,
    applyExpressiveRendering,
    // test helpers
    _parseViewBox: parseViewBox,
    _resolvePictograms: resolvePictograms,
    _normalizeGraphicsInHtml: normalizeGraphicsInHtml,
    _formatNum: formatNum,
  };

  root.MemoryEngineExpressive = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
