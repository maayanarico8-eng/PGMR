/**
 * Anthropic API client — Sonnet for semantics, Haiku for pictogram realization.
 */
(function (root) {
  const MODEL = 'claude-sonnet-5';
  const HAIKU_MODEL = 'claude-haiku-4-5';
  const MAX_ATTEMPTS = 4;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractTextFromResponse(data) {
    if (!data?.content) return '';
    return data.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }

  function balancedBraceSlice(s) {
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (escape) escape = false;
        else if (ch === '\\') escape = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  function parseModelJSON(raw) {
    if (!raw) throw new Error('Empty response');
    let s = raw.trim().replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
    const firstBrace = s.indexOf('{');
    if (firstBrace === -1) throw new Error('No JSON object found');
    s = s.slice(firstBrace);
    try {
      return JSON.parse(s);
    } catch (err) {
      const posMatch = /position\s+(\d+)/i.exec(err.message || '');
      if (posMatch) {
        try { return JSON.parse(s.slice(0, parseInt(posMatch[1], 10))); } catch (_) {}
      }
      const balanced = balancedBraceSlice(s);
      if (balanced) return JSON.parse(balanced);
      throw err;
    }
  }

  async function callClaude(body) {
    const payload = { ...body, model: body.model || MODEL };
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        await sleep(2000 * attempt + Math.floor(Math.random() * 1000));
        continue;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = new Error(`API ${res.status}: ${data?.error?.message || res.statusText}`);
        if (res.status !== 429) throw lastError;
        continue;
      }
      return extractTextFromResponse(data);
    }
    throw lastError || new Error('Anthropic API request failed after retries');
  }

  async function callClaudeJSON(body) {
    return parseModelJSON(await callClaude(body));
  }

  async function callHaiku(body) {
    return callClaude({ ...body, model: HAIKU_MODEL });
  }

  async function callHaikuJSON(body) {
    return parseModelJSON(await callHaiku(body));
  }

  root.MemoryEngineAnthropic = {
    MODEL,
    HAIKU_MODEL,
    callClaude,
    callClaudeJSON,
    callHaiku,
    callHaikuJSON,
    parseModelJSON,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
