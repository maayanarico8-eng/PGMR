module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    res.status(500).json({
      error: { message: 'ANTHROPIC_API_KEY is not configured. Add it in Vercel project settings.' },
    });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(500).json({
      error: { message: err.message || 'Anthropic proxy request failed' },
    });
  }
};
