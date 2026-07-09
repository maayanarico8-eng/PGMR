/**
 * Pictogram realization — Streamline reference fetch → Haiku Maayan restyle → cache.
 */
(function (root) {
  const CACHE_API_URL = '/api/pictogram-cache';
  const MAX_GENERATION_ATTEMPTS = 2;

  let cacheData = null;
  let cacheLoadPromise = null;

  function normalizeEnglish(s) {
    return (s || '').toLowerCase().trim();
  }

  function streamline() {
    return root.MemoryEngineCatalogStreamlineProvider;
  }

  function anthropic() {
    return root.MemoryEngineAnthropic;
  }

  function promptBundle() {
    return root.MemoryEngineRule3 || {};
  }

  function cacheFileCandidates() {
    if (typeof window !== 'undefined') return [];
    const path = require('path');
    return [path.join(__dirname, '../../../pictograms/pictogram-cache.json')];
  }

  function readCacheFromDisk() {
    const fs = require('fs');
    for (const file of cacheFileCandidates()) {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    }
    return { version: 1, icons: {} };
  }

  function ensureCacheLoadedSync() {
    if (cacheData) return cacheData;
    if (typeof window === 'undefined') {
      cacheData = readCacheFromDisk();
      return cacheData;
    }
    return cacheData || { version: 1, icons: {} };
  }

  async function loadCache(force) {
    if (cacheData && !force) return cacheData;
    if (cacheLoadPromise && !force) return cacheLoadPromise;

    if (typeof window === 'undefined') {
      cacheData = readCacheFromDisk();
      return cacheData;
    }

    cacheLoadPromise = (async () => {
      const res = await fetch(CACHE_API_URL);
      if (!res.ok) throw new Error(`Failed to load pictogram cache (${res.status})`);
      cacheData = await res.json();
      return cacheData;
    })();

    return cacheLoadPromise;
  }

  function getCachedEntry(english) {
    ensureCacheLoadedSync();
    const key = normalizeEnglish(english);
    if (!key || !cacheData?.icons) return null;
    return cacheData.icons[key] || null;
  }

  function hasCached(english) {
    return !!getCachedEntry(english)?.svg;
  }

  async function saveCacheEntry(english, entry) {
    const key = normalizeEnglish(english);
    await loadCache();
    if (!cacheData.icons) cacheData.icons = {};
    cacheData.icons[key] = entry;

    if (typeof window === 'undefined') {
      const fs = require('fs');
      const path = require('path');
      for (const file of cacheFileCandidates()) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(cacheData, null, 2)}\n`, 'utf8');
        return;
      }
      return;
    }

    try {
      const res = await fetch(CACHE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english: key, entry }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('pictogram-cache save:', body.error?.message || res.status);
      } else {
        const body = await res.json().catch(() => ({}));
        if (body.entry && cacheData?.icons) {
          cacheData.icons[key] = body.entry;
        }
      }
    } catch (err) {
      console.warn('pictogram-cache save error:', err.message);
    }
  }

  function registerSession(svg, meta) {
    root.MemoryEngineStreamlineSession?.register?.(svg, meta);
  }

  function validateMaayanSvg(svg) {
    if (!svg || typeof svg !== 'string') return { ok: false, reason: 'empty svg' };
    const s = svg.trim();
    if (!/^<svg[\s>]/i.test(s)) return { ok: false, reason: 'root must be svg' };
    if (!/viewBox\s*=\s*["']0\s+0\s+64\s+64["']/i.test(s)) {
      return { ok: false, reason: 'viewBox must be 0 0 64 64' };
    }
    if (/\btransform\s*=/i.test(s)) return { ok: false, reason: 'transform attributes not allowed' };

    const paths = s.match(/<path\b/gi) || [];
    if (paths.length !== 1) return { ok: false, reason: 'exactly one path element required' };

    const forbidden = s.match(/<(?:circle|ellipse|rect|line|polyline|polygon|text|image|g)\b/gi);
    if (forbidden) return { ok: false, reason: 'only a single path inside svg is allowed' };

    const strokeOk =
      /stroke\s*=\s*["']#000000["']/i.test(s) ||
      /stroke\s*=\s*["']#000["']/i.test(s);
    if (!strokeOk) return { ok: false, reason: 'stroke must be #000000' };

    if (!/stroke-width\s*=\s*["']1(?:\.0)?["']/i.test(s)) {
      return { ok: false, reason: 'stroke-width must be 1.0' };
    }

    if (/fill\s*=\s*["'](?!none)[^"']+["']/i.test(s)) {
      return { ok: false, reason: 'fill must be none' };
    }

    const dMatch = s.match(/<path[^>]*\sd\s*=\s*["']([^"']+)["']/i);
    if (!dMatch) return { ok: false, reason: 'path d attribute required' };
    if (/[CQSTcqst]/.test(dMatch[1])) {
      return { ok: false, reason: 'path d must use only M L A Z H V' };
    }

    return { ok: true };
  }

  function buildReferenceUserMessage(english, referenceSvg, options) {
    const lines = [`Concept (English): ${english}`];
    if (options?.hebrew) lines.push(`Hebrew: ${options.hebrew}`);
    if (options?.category) lines.push(`Category: ${options.category}`);
    lines.push('', 'Reference SVG (external icon — concept identity only, restyle to grammar):', referenceSvg);
    return lines.join('\n');
  }

  function buildFallbackUserMessage(english, options) {
    const lines = [`Concept (English): ${english}`];
    if (options?.hebrew) lines.push(`Hebrew: ${options.hebrew}`);
    if (options?.category) lines.push(`Category: ${options.category}`);
    lines.push('', 'No reference SVG is available. Generate a pictogram for this concept from scratch.');
    return lines.join('\n');
  }

  async function callHaikuPictogram(systemPrompt, userContent, retryUserSuffix, attempt) {
    const api = anthropic();
    const prompts = promptBundle();
    if (!api?.callHaikuJSON) throw new Error('MemoryEngineAnthropic.callHaikuJSON is not available');
    if (!systemPrompt) throw new Error('Pictogram system prompt is not loaded');

    let content = userContent;
    if (attempt > 1) {
      content += retryUserSuffix;
    }

    const parsed = await api.callHaikuJSON({
      max_tokens: 2500,
      system: `${prompts.PICTOGRAM_JSON_SYSTEM || 'Output valid JSON only.'}\n\n${systemPrompt}`,
      messages: [{ role: 'user', content }],
    });

    const svg = parsed?.svg;
    const validation = validateMaayanSvg(svg);
    if (!validation.ok) {
      if (attempt < MAX_GENERATION_ATTEMPTS) {
        return callHaikuPictogram(systemPrompt, userContent, retryUserSuffix, attempt + 1);
      }
      throw new Error(`Maayan SVG validation failed: ${validation.reason}`);
    }

    return {
      svg,
      geometricDescription: parsed.geometricDescription || null,
    };
  }

  const RETRY_SUFFIX =
    '\n\nPrevious output failed grammar validation. Simplify. Output one compliant single-path SVG.';

  async function realizeWithHaiku(english, referenceSvg, options, attempt) {
    const prompts = promptBundle();
    const realizePrompt = prompts.PICTOGRAM_REALIZE_PROMPT;
    if (!realizePrompt) throw new Error('PICTOGRAM_REALIZE_PROMPT is not loaded');

    return callHaikuPictogram(
      realizePrompt,
      buildReferenceUserMessage(english, referenceSvg, options),
      RETRY_SUFFIX,
      attempt || 1
    );
  }

  async function generateFromScratchWithHaiku(english, options, attempt) {
    const prompts = promptBundle();
    const fallbackPrompt = prompts.PICTOGRAM_FALLBACK_PROMPT;
    if (!fallbackPrompt) throw new Error('PICTOGRAM_FALLBACK_PROMPT is not loaded');

    return callHaikuPictogram(
      fallbackPrompt,
      buildFallbackUserMessage(english, options),
      RETRY_SUFFIX,
      attempt || 1
    );
  }

  async function resolveIcon(english, options) {
    const term = normalizeEnglish(english);
    if (!term) return null;

    await loadCache();
    const cached = getCachedEntry(term);
    if (cached?.svg) {
      registerSession(cached.svg, { english: term, source: 'cache' });
      return {
        svg: cached.svg,
        source: 'cache',
        english: term,
        hash: cached.streamlineHash || null,
      };
    }

    const sl = options?.streamline || streamline();
    const reference = sl?.resolveIcon ? await sl.resolveIcon(term, options) : null;

    let realized;
    let generationMode = 'fallback';
    let streamlineHash = null;
    let streamlineSource = null;

    if (reference?.svg) {
      realized = await realizeWithHaiku(term, reference.svg, options, 1);
      generationMode = 'reference';
      streamlineHash = reference.hash || null;
      streamlineSource = reference.source || null;
    } else {
      realized = await generateFromScratchWithHaiku(term, options, 1);
    }

    if (!realized?.svg) return null;

    const source = generationMode === 'reference' ? 'generated' : 'generated-fallback';

    const entry = {
      svg: realized.svg,
      hebrew: options?.hebrew || null,
      category: options?.category || null,
      geometricDescription: realized.geometricDescription,
      generationMode,
      streamlineHash,
      streamlineSource,
      generatedAt: new Date().toISOString(),
    };
    await saveCacheEntry(term, entry);

    registerSession(realized.svg, {
      english: term,
      source,
      generationMode,
      streamlineHash,
    });

    return {
      svg: realized.svg,
      source,
      english: term,
      hash: streamlineHash,
      generationMode,
    };
  }

  async function fetchPictogram(opts) {
    const english = opts?.english || opts?.englishWord || opts?.canonicalReferent;
    if (!english) return null;
    return resolveIcon(english, opts);
  }

  function clearCache() {
    cacheData = null;
    cacheLoadPromise = null;
  }

  root.MemoryEngineCatalogPictogramRealizeProvider = {
    loadCache,
    ensureCacheLoadedSync,
    getCachedEntry,
    hasCached,
    saveCacheEntry,
    validateMaayanSvg,
    realizeWithHaiku,
    generateFromScratchWithHaiku,
    resolveIcon,
    fetchPictogram,
    clearCache,
    normalizeEnglish,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
