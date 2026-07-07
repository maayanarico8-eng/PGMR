const fs = require('fs');
const path = require('path');

const MAPPING_PATH = path.join(process.cwd(), 'memory-processor/pictograms/streamline-mapping.json');
const BLOB_PATHNAME = 'streamline-mapping.json';

function emptyMapping() {
  return { version: 1, icons: {} };
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
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1, token });
  if (!blobs.length) return null;

  const downloadUrl = blobs[0].downloadUrl || blobs[0].url;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch blob mapping (${res.status})`);
  }
  return res.json();
}

async function writeMappingToBlob(mapping) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const { put } = await import('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(mapping, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
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
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    await writeMappingToBlob(mapping);
    return 'blob';
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

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
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
