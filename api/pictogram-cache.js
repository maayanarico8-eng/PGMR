const fs = require('fs');
const path = require('path');

const CACHE_PATH = path.join(process.cwd(), 'memory-processor/pictograms/pictogram-cache.json');
const BLOB_PATHNAME = 'pictogram-cache.json';

function emptyCache() {
  return { version: 1, icons: {} };
}

function hasBlobConfig() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

function blobOptions() {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  return storeId ? { storeId } : {};
}

function readCacheFromDisk() {
  if (!fs.existsSync(CACHE_PATH)) {
    return emptyCache();
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
}

function writeCacheToDisk(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
}

async function readCacheFromBlob() {
  if (!hasBlobConfig()) return null;

  const { get } = await import('@vercel/blob');
  const opts = { access: 'private', ...blobOptions() };

  try {
    const result = await get(BLOB_PATHNAME, opts);
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    const msg = err?.message || '';
    if (err?.name === 'BlobNotFoundError' || /not found/i.test(msg)) return null;
    throw err;
  }
}

async function writeCacheToBlob(cache) {
  const { put } = await import('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(cache, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    ...blobOptions(),
  });
}

async function readCache() {
  const fromDisk = readCacheFromDisk();
  const diskIcons = fromDisk.icons || {};
  // Committed bank on disk is the source of truth for the pictogram bank UI.
  // Do not merge Blob-only Streamline fills (those used to reappear as "Streamline / cached").
  if (Object.keys(diskIcons).length > 0) {
    return { version: fromDisk.version || 1, icons: diskIcons };
  }
  try {
    const fromBlob = await readCacheFromBlob();
    if (fromBlob) return fromBlob;
  } catch (err) {
    console.warn('pictogram-cache blob read failed:', err.message);
  }
  return fromDisk;
}

async function writeCache(cache) {
  if (hasBlobConfig()) {
    await writeCacheToBlob(cache);
    return 'blob';
  }
  if (process.env.VERCEL === '1') {
    throw new Error('Blob store not linked. Connect pgmr-blob to this project in Vercel Storage.');
  }
  writeCacheToDisk(cache);
  return 'disk';
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const cache = await readCache();
      const english = req.query?.english;
      if (english) {
        const key = String(english).toLowerCase().trim();
        const entry = cache.icons?.[key] || null;
        res.status(200).json({ english: key, entry });
        return;
      }
      res.status(200).json(cache);
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to read pictogram cache' } });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const english = req.query?.english || req.body?.english;
      if (!english) {
        res.status(400).json({ error: { message: 'english is required' } });
        return;
      }
      const key = String(english).toLowerCase().trim();
      const cache = await readCache();
      if (!cache.icons?.[key]) {
        res.status(404).json({ error: { message: `No entry for "${key}"` } });
        return;
      }
      delete cache.icons[key];
      const storage = await writeCache(cache);
      res.status(200).json({ ok: true, deleted: key, storage });
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to delete pictogram cache entry' } });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    if (req.body?.delete === true) {
      const english = req.body?.english;
      if (!english) {
        res.status(400).json({ error: { message: 'english is required' } });
        return;
      }
      const key = String(english).toLowerCase().trim();
      const cache = await readCache();
      if (!cache.icons?.[key]) {
        res.status(404).json({ error: { message: `No entry for "${key}"` } });
        return;
      }
      delete cache.icons[key];
      const storage = await writeCache(cache);
      res.status(200).json({ ok: true, deleted: key, storage });
      return;
    }

    if (req.body?.reset === true) {
      const cache = emptyCache();
      const storage = await writeCache(cache);
      res.status(200).json({ ok: true, reset: true, cache, storage });
      return;
    }

    // Overwrite Blob with the committed disk bank (drops Streamline-only fills).
    if (req.body?.replace === true || req.body?.syncDisk === true) {
      const cache = readCacheFromDisk();
      const storage = await writeCache(cache);
      res.status(200).json({
        ok: true,
        replaced: true,
        count: Object.keys(cache.icons || {}).length,
        storage,
      });
      return;
    }

    const { english, entry, entries } = req.body || {};

    if (entries && typeof entries === 'object' && !Array.isArray(entries)) {
      const cache = await readCache();
      if (!cache.icons) cache.icons = {};
      const saved = {};
      for (const [rawKey, rawEntry] of Object.entries(entries)) {
        if (!rawEntry?.svg) continue;
        const key = String(rawKey).toLowerCase().trim();
        if (!key) continue;
        cache.icons[key] = {
          svg: rawEntry.svg,
          hash: rawEntry.hash || null,
          cachedAt: rawEntry.cachedAt || new Date().toISOString(),
        };
        saved[key] = cache.icons[key];
      }
      if (!Object.keys(saved).length) {
        res.status(400).json({ error: { message: 'entries must include at least one entry with svg' } });
        return;
      }
      const storage = await writeCache(cache);
      res.status(200).json({ ok: true, saved: Object.keys(saved), entries: saved, storage });
      return;
    }

    if (!english || !entry?.svg) {
      res.status(400).json({ error: { message: 'english and entry.svg are required' } });
      return;
    }

    const cache = await readCache();
    if (!cache.icons) cache.icons = {};
    const key = String(english).toLowerCase().trim();
    cache.icons[key] = {
      svg: entry.svg,
      hash: entry.hash || null,
      cachedAt: entry.cachedAt || new Date().toISOString(),
    };
    const storage = await writeCache(cache);
    res.status(200).json({ ok: true, english: key, entry: cache.icons[key], storage });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Failed to write pictogram cache' } });
  }
};
