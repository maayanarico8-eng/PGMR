const fs = require('fs');
const path = require('path');
const { DEFAULT_FAMILY_SLUG } = require('./streamline-config');

const MAPPING_PATH = path.join(process.cwd(), 'memory-processor/pictograms/streamline-mapping.json');
const BLOB_PATHNAME = 'streamline-mapping.json';

function emptyMapping() {
  return {
    version: 2,
    meta: { searchMode: 'family', familySlug: DEFAULT_FAMILY_SLUG },
    icons: {},
  };
}

function hasBlobConfig() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

function blobOptions() {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  return storeId ? { storeId } : {};
}

function readMappingFromDisk() {
  if (!fs.existsSync(MAPPING_PATH)) {
    return emptyMapping();
  }
  return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
}

function writeMappingToDisk(mapping) {
  fs.mkdirSync(path.dirname(MAPPING_PATH), { recursive: true });
  fs.writeFileSync(MAPPING_PATH, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
}

async function readMappingFromBlob() {
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

async function writeMappingToBlob(mapping) {
  const { put } = await import('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(mapping, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    ...blobOptions(),
  });
}

async function readMapping() {
  try {
    const fromBlob = await readMappingFromBlob();
    if (fromBlob) return fromBlob;
  } catch (err) {
    console.warn('streamline-mapping blob read failed:', err.message);
  }
  return readMappingFromDisk();
}

async function writeMapping(mapping) {
  if (hasBlobConfig()) {
    await writeMappingToBlob(mapping);
    return 'blob';
  }
  if (process.env.VERCEL === '1') {
    throw new Error('Blob store not linked. Connect pgmr-blob to this project in Vercel Storage.');
  }
  writeMappingToDisk(mapping);
  return 'disk';
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const mapping = await readMapping();
      res.status(200).json(mapping);
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to read mapping' } });
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
      const mapping = await readMapping();
      if (!mapping.icons?.[key]) {
        res.status(404).json({ error: { message: `No entry for "${key}"` } });
        return;
      }
      delete mapping.icons[key];
      const storage = await writeMapping(mapping);
      res.status(200).json({ ok: true, deleted: key, storage });
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to delete mapping entry' } });
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
      const mapping = await readMapping();
      if (!mapping.icons?.[key]) {
        res.status(404).json({ error: { message: `No entry for "${key}"` } });
        return;
      }
      delete mapping.icons[key];
      const storage = await writeMapping(mapping);
      res.status(200).json({ ok: true, deleted: key, storage });
      return;
    }

    if (req.body?.reset === true) {
      const mapping = emptyMapping();
      const storage = await writeMapping(mapping);
      res.status(200).json({ ok: true, reset: true, mapping, storage });
      return;
    }

    const { english, entry } = req.body || {};
    if (!english || !entry?.hash) {
      res.status(400).json({ error: { message: 'english and entry.hash are required' } });
      return;
    }

    const mapping = await readMapping();
    if (!mapping.icons) mapping.icons = {};
    const key = String(english).toLowerCase().trim();
    mapping.icons[key] = entry;
    const storage = await writeMapping(mapping);
    res.status(200).json({ ok: true, english: key, entry, storage });
  } catch (err) {
    res.status(500).json({ error: { message: err.message || 'Failed to write mapping' } });
  }
};
