const fs = require('fs');
const path = require('path');

const MAPPING_PATH = path.join(process.cwd(), 'memory-processor/pictograms/streamline-mapping.json');
const BLOB_PATHNAME = 'streamline-mapping.json';

function emptyMapping() {
  return { version: 1, icons: {} };
}

function hasBlobConfig() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

function blobAuthHeaders() {
  const oidc = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (oidc) return { Authorization: `Bearer ${oidc}` };
  const rw = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (rw) return { Authorization: `Bearer ${rw}` };
  return {};
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

  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 1 });
  if (!blobs.length) return null;

  const downloadUrl = blobs[0].downloadUrl || blobs[0].url;
  const res = await fetch(downloadUrl, { headers: blobAuthHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to fetch blob mapping (${res.status})`);
  }
  return res.json();
}

async function writeMappingToBlob(mapping) {
  const { put } = await import('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(mapping, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
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
