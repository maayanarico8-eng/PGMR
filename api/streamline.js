module.exports = async (req, res) => {
  const apiKey = process.env.STREAMLINE_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).json({
      error: { message: 'STREAMLINE_API_KEY is not configured. Add it in Vercel project settings.' },
    });
    return;
  }

  const action = req.query?.action || req.body?.action;
  const q = { ...req.query, ...req.body };

  try {
    if (action === 'search') {
      const query = q.query;
      if (!query) {
        res.status(400).json({ error: { message: 'query is required' } });
        return;
      }
      const params = new URLSearchParams({
        productType: 'icons',
        query: String(query),
        limit: String(q.limit || '10'),
      });
      const upstream = await fetch(`https://public-api.streamlinehq.com/v1/search/global?${params}`, {
        headers: { 'x-api-key': apiKey },
      });
      const body = await upstream.json();
      res.status(upstream.status).json(body);
      return;
    }

    if (action === 'download') {
      const hash = q.hash;
      if (!hash) {
        res.status(400).json({ error: { message: 'hash is required' } });
        return;
      }
      const params = new URLSearchParams({
        size: String(q.size ?? 64),
        responsive: String(q.responsive ?? true),
        strokeToFill: String(q.strokeToFill ?? false),
        backgroundColor: String(q.backgroundColor ?? '#ffffff00'),
      });
      if (q.colors) params.set('colors', String(q.colors));
      if (q.strokeWidth != null && q.strokeWidth !== '') {
        params.set('strokeWidth', String(q.strokeWidth));
      }

      const upstream = await fetch(
        `https://public-api.streamlinehq.com/v1/icons/${encodeURIComponent(hash)}/download/svg?${params}`,
        { headers: { 'x-api-key': apiKey, Accept: 'image/svg+xml' } }
      );

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        res.status(upstream.status).json({
          error: { message: err.message || `Streamline download failed (${upstream.status})` },
        });
        return;
      }

      const svg = await upstream.text();
      res.status(200).json({ svg });
      return;
    }

    res.status(400).json({ error: { message: 'Invalid action. Use search or download.' } });
  } catch (err) {
    res.status(500).json({
      error: { message: err.message || 'Streamline proxy request failed' },
    });
  }
};
