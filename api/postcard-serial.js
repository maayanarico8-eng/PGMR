const fs = require('fs');
const path = require('path');

const SERIAL_PATH = path.join(process.cwd(), 'memory-processor/data/postcard-serial.json');
const BLOB_PATHNAME = 'postcard-serial.json';
const START_SERIAL = 128;

function emptyState() {
  return { version: 1, next: START_SERIAL };
}

function hasBlobConfig() {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

function blobOptions() {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  return storeId ? { storeId } : {};
}

function normalizeState(raw) {
  const next = Number(raw?.next);
  if (!Number.isFinite(next) || next < START_SERIAL) return emptyState();
  return { version: 1, next: Math.floor(next) };
}

function readStateFromDisk() {
  if (!fs.existsSync(SERIAL_PATH)) return emptyState();
  try {
    return normalizeState(JSON.parse(fs.readFileSync(SERIAL_PATH, 'utf8')));
  } catch {
    return emptyState();
  }
}

function writeStateToDisk(state) {
  fs.mkdirSync(path.dirname(SERIAL_PATH), { recursive: true });
  fs.writeFileSync(SERIAL_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function readStateFromBlob() {
  if (!hasBlobConfig()) return null;

  const { get } = await import('@vercel/blob');
  const opts = { access: 'private', ...blobOptions() };

  try {
    const result = await get(BLOB_PATHNAME, opts);
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return normalizeState(JSON.parse(text));
  } catch (err) {
    const msg = err?.message || '';
    if (err?.name === 'BlobNotFoundError' || /not found/i.test(msg)) return null;
    throw err;
  }
}

async function writeStateToBlob(state) {
  const { put } = await import('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(state, null, 2), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    ...blobOptions(),
  });
}

async function readState() {
  try {
    const fromBlob = await readStateFromBlob();
    if (fromBlob) return fromBlob;
  } catch (err) {
    console.warn('postcard-serial blob read failed:', err.message);
  }
  return readStateFromDisk();
}

async function writeState(state) {
  if (hasBlobConfig()) {
    await writeStateToBlob(state);
    return 'blob';
  }
  if (process.env.VERCEL === '1') {
    throw new Error('Blob store not linked. Connect pgmr-blob to this project in Vercel Storage.');
  }
  writeStateToDisk(state);
  return 'disk';
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const state = await readState();
      res.status(200).json({ serial: state.next });
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to read postcard serial' } });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = String(body.action || '').trim();
      if (action !== 'complete') {
        res.status(400).json({ error: { message: 'action must be "complete"' } });
        return;
      }
      const state = await readState();
      const printed = state.next;
      const nextState = { version: 1, next: printed + 1 };
      const storage = await writeState(nextState);
      res.status(200).json({ serial: printed, next: nextState.next, storage });
    } catch (err) {
      res.status(500).json({ error: { message: err.message || 'Failed to advance postcard serial' } });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: { message: 'Method not allowed' } });
};
