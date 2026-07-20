/**
 * Canonical pictogram SVG normalizer — size 64, stroke 0.5, color #000000.
 * Works in browser and Node (string rewrite; no DOM dependency).
 */
(function (root) {
  const SIZE = 64;
  const STROKE_WIDTH = '0.5';
  const STROKE_COLOR = '#000000';
  const FILL = 'none';
  const GRAPHIC_TAGS = 'path,rect,circle,ellipse,line,polyline,polygon';

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
    // Inline style can override presentation attrs — rewrite or drop
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
   * Normalize a pictogram SVG string to size 64, stroke 0.5, color #000000.
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

  const api = {
    SIZE,
    STROKE_WIDTH,
    STROKE_COLOR,
    FILL,
    stripSvgProlog,
    normalizePictogramSvg,
  };

  root.MemoryEngineNormalizePictogramSvg = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
