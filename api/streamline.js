const { DEFAULT_FAMILY_SLUG, buildDownloadQueryParams } = require('./streamline-config');

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
    if (action === 'family-search') {
      const query = q.query;
      const familySlug = q.familySlug || DEFAULT_FAMILY_SLUG;
      if (!query) {
        res.status(400).json({ error: { message: 'query is required' } });
        return;
      }
      const params = new URLSearchParams({
        query: String(query),
        limit: String(q.limit || '10'),
      });
      if (q.offset != null && q.offset !== '') params.set('offset', String(q.offset));

      const upstream = await fetch(
        `https://public-api.streamlinehq.com/v1/search/family/${encodeURIComponent(familySlug)}?${params}`,
        { headers: { 'x-api-key': apiKey } }
      );
      const body = await upstream.json();
      res.status(upstream.status).json(body);
      return;
    }

    if (action === 'search') {
      const query = q.query;
      if (!query) {
        res.status(400).json({ error: { message: 'query is required' } });
        return;
      }
      const params = new URLSearchParams({
        productType: String(q.productType || 'icons'),
        query: String(query),
        limit: String(q.limit || '10'),
        productTier: String(q.productTier || 'premium'),
      });
      if (q.style) params.set('style', String(q.style));
      if (q.offset != null && q.offset !== '') params.set('offset', String(q.offset));

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

      const params = buildDownloadQueryParams({
        size: q.size,
        responsive: q.responsive,
        strokeToFill: q.strokeToFill,
        backgroundColor: q.backgroundColor,
        colors: q.colors,
        strokeWidth: q.strokeWidth,
      });

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

    /** PNG preview for Claude vision — avoids SVG download until a winner is chosen. */
    if (action === 'preview') {
      const hash = q.hash;
      if (!hash) {
        res.status(400).json({ error: { message: 'hash is required' } });
        return;
      }
      const size = String(q.size || '128');
      const params = new URLSearchParams({ size });
      const upstream = await fetch(
        `https://public-api.streamlinehq.com/v1/icons/${encodeURIComponent(hash)}/download/png?${params}`,
        { headers: { 'x-api-key': apiKey, Accept: 'image/png' } }
      );
      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        res.status(upstream.status).json({
          error: { message: err.message || `Streamline preview failed (${upstream.status})` },
        });
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(200).json({
        hash,
        mediaType: 'image/png',
        data: buf.toString('base64'),
      });
      return;
    }

    res.status(400).json({
      error: { message: 'Invalid action. Use family-search, search, download, or preview.' },
    });
  } catch (err) {
    res.status(500).json({
      error: { message: err.message || 'Streamline proxy request failed' },
    });
  }
};
