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
  try {
    const fromBlob = await readCacheFromBlob();
    if (fromBlob) return fromBlob;
  } catch (err) {
    console.warn('pictogram-cache blob read failed:', err.message);
  }
  return readCacheFromDisk();
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
      res.status(200).json(cache);
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to read pictogram cache' } });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    if (req.body?.reset === true) {
      const cache = emptyCache();
      const storage = await writeCache(cache);
      res.status(200).json({ ok: true, reset: true, cache, storage });
      return;
    }

    const { english, entry } = req.body || {};
    if (!english || !entry?.svg) {
      res.status(400).json({ error: { message: 'english and entry.svg are required' } });
      return;
    }

    const cache = await readCache();
    if (!cache.icons) cache.icons = {};
    const key = String(english).toLowerCase().trim();
    cache.icons[key] = entry;
    const storage = await writeCache(cache);
    res.status(200).json({ ok: true, english: key, entry, storage });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Failed to write pictogram cache' } });
  }
};
