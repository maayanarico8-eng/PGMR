/**
 * Claude vision picker — chooses the best Streamline icon from top-10 search previews.
 * Prefers search `imagePreviewUrl` (no Streamline download). Falls back to PNG proxy if needed.
 */
(function (root) {
  function isHttpsUrl(s) {
    return /^https:\/\//i.test(String(s || '').trim());
  }

  async function fetchPreviewBase64(hash) {
    if (!hash) return null;
    const qs = new URLSearchParams({ action: 'preview', hash, size: '128' });
    const res = await fetch(`/api/streamline?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error?.message || `Streamline preview ${res.status}`);
    }
    if (!body.data) return null;
    return {
      kind: 'base64',
      mediaType: body.mediaType || 'image/png',
      data: body.data,
    };
  }

  /**
   * Prefer CDN preview URLs from search; only hit Streamline PNG download as fallback.
   */
  async function loadCandidateImages(candidates) {
    const out = [];
    for (const c of candidates || []) {
      if (!c?.hash) continue;
      const url = c.previewUrl || c.imagePreviewUrl;
      if (isHttpsUrl(url)) {
        out.push({
          ...c,
          image: { kind: 'url', url: String(url).trim() },
        });
        continue;
      }
      let image = null;
      try {
        image = await fetchPreviewBase64(c.hash);
      } catch (err) {
        console.warn('pictogram preview failed:', c.hash, err.message);
      }
      if (!image?.data) continue;
      out.push({ ...c, image });
    }
    return out;
  }

  function imageContentBlock(image) {
    if (image?.kind === 'url' && image.url) {
      return {
        type: 'image',
        source: { type: 'url', url: image.url },
      };
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType || 'image/png',
        data: image.data,
      },
    };
  }

  function buildUserContent(english, imaged, opts) {
    const lines = [
      `English pictogram term: ${english}`,
    ];
    if (opts?.hebrew) lines.push(`Hebrew word: ${opts.hebrew}`);
    if (opts?.context) lines.push(`Memory context: ${opts.context}`);
    lines.push('', 'Candidates (each image follows its label):');
    imaged.forEach((c, i) => {
      lines.push(`${i}. hash=${c.hash} name=${JSON.stringify(c.name || '')} index=${c.index}`);
    });
    lines.push('', 'Apply Icon Selection Rules. Return JSON only.');

    const content = [{ type: 'text', text: lines.join('\n') }];
    imaged.forEach((c, i) => {
      content.push({
        type: 'text',
        text: `Candidate ${i} (hash=${c.hash}):`,
      });
      content.push(imageContentBlock(c.image));
    });
    return content;
  }

  /**
   * @returns {Promise<{ winnerHash: string, winnerIndex?: number, rationale?: string } | null>}
   */
  async function selectPictogramFromCandidates(english, candidates, opts) {
    const anthropic = root.MemoryEngineAnthropic;
    const promptMod = root.MemoryEngineSelectPictogramPrompt;
    if (!anthropic?.callClaudeJSON || !promptMod?.SELECT_PICTOGRAM_PROMPT) return null;
    if (!english || !candidates?.length) return null;

    const imaged = await loadCandidateImages(candidates);
    if (!imaged.length) return null;

    const allowed = new Set(imaged.map((c) => c.hash));
    const parsed = await anthropic.callClaudeJSON({
      model: promptMod.SELECT_PICTOGRAM_MODEL,
      max_tokens: 800,
      system: promptMod.SELECT_PICTOGRAM_PROMPT,
      messages: [{ role: 'user', content: buildUserContent(english, imaged, opts || {}) }],
    });

    const winnerHash = String(parsed?.winnerHash || '').trim();
    if (!winnerHash || !allowed.has(winnerHash)) {
      const byIndex = imaged[parsed?.winnerIndex];
      if (byIndex?.hash && allowed.has(byIndex.hash)) {
        return {
          winnerHash: byIndex.hash,
          winnerIndex: byIndex.index,
          rationale: parsed?.rationale || '',
        };
      }
      return null;
    }

    const match = imaged.find((c) => c.hash === winnerHash);
    return {
      winnerHash,
      winnerIndex: match?.index ?? parsed?.winnerIndex,
      rationale: parsed?.rationale || '',
    };
  }

  root.MemoryEngineSelectPictogram = {
    selectPictogramFromCandidates,
    fetchPreviewBase64,
    loadCandidateImages,
    isHttpsUrl,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
