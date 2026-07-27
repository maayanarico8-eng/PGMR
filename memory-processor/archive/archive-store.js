/**
 * Exhibition archive — local IndexedDB persistence.
 * One DB on the kiosk Chrome profile: memories + meta.nextSerial.
 *
 * Phase 1: serial peek / advance + full-DB export.
 * Phase 2: commitMemory() inserts a record and advances serial in one transaction.
 */
(function (global) {
  const DB_NAME = 'pgmr-exhibition-archive';
  const DB_VERSION = 1;
  const STORE_MEMORIES = 'memories';
  const STORE_META = 'meta';
  const META_ID = 'state';
  /** First postcard / visitor archive card number. 001 is the static base memory. */
  const INITIAL_NEXT_SERIAL = 2;

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('[archive-store] IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error || new Error('[archive-store] open failed'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
          db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
    return dbPromise;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('[archive-store] request failed'));
    });
  }

  function transactionDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('[archive-store] transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('[archive-store] transaction aborted'));
    });
  }

  /**
   * Run readwrite work across memories + meta in one transaction.
   * fn(stores, tx) may be sync or async; the transaction stays open until fn settles
   * and pending IDB requests finish (Chrome keeps tx alive across microtasks/await
   * while requests are outstanding).
   */
  async function withWriteTransaction(fn) {
    const db = await openDb();
    const tx = db.transaction([STORE_MEMORIES, STORE_META], 'readwrite');
    const stores = {
      memories: tx.objectStore(STORE_MEMORIES),
      meta: tx.objectStore(STORE_META),
    };
    const done = transactionDone(tx);
    const result = await fn(stores, tx);
    await done;
    return result;
  }

  async function withReadTransaction(fn) {
    const db = await openDb();
    const tx = db.transaction([STORE_MEMORIES, STORE_META], 'readonly');
    const stores = {
      memories: tx.objectStore(STORE_MEMORIES),
      meta: tx.objectStore(STORE_META),
    };
    const done = transactionDone(tx);
    const result = await fn(stores, tx);
    await done;
    return result;
  }

  async function readMetaRecord(metaStore) {
    const raw = await requestToPromise(metaStore.get(META_ID));
    if (raw && Number.isFinite(Number(raw.nextSerial)) && Number(raw.nextSerial) >= INITIAL_NEXT_SERIAL) {
      return { id: META_ID, nextSerial: Math.floor(Number(raw.nextSerial)) };
    }
    return null;
  }

  async function ensureMeta(metaStore) {
    const existing = await readMetaRecord(metaStore);
    if (existing) return existing;
    const initial = { id: META_ID, nextSerial: INITIAL_NEXT_SERIAL };
    await requestToPromise(metaStore.put(initial));
    return initial;
  }

  /** Current next serial for canvas display (does not advance). Initializes to 2 on first run. */
  async function getNextSerial() {
    return withWriteTransaction(async (stores) => {
      const meta = await ensureMeta(stores.meta);
      return meta.nextSerial;
    });
  }

  /**
   * Advance serial after a print flow. Returns { serial, next }
   * where serial is the number that was just used on the postcard.
   */
  async function advanceSerial() {
    return withWriteTransaction(async (stores) => {
      const meta = await ensureMeta(stores.meta);
      const serial = meta.nextSerial;
      const next = serial + 1;
      await requestToPromise(stores.meta.put({ id: META_ID, nextSerial: next }));
      return { serial, next };
    });
  }

  /**
   * Phase 2 entry point: assign id from nextSerial, put memory, advance — one transaction.
   * buildFn(serialNumber) must return a record with id already set to zero-padded serial
   * (or id is overwritten here from the allocated serial).
   */
  async function commitMemory(buildFn) {
    if (typeof buildFn !== 'function') {
      throw new Error('[archive-store] commitMemory requires buildFn(serial)');
    }
    return withWriteTransaction(async (stores) => {
      const meta = await ensureMeta(stores.meta);
      const serial = meta.nextSerial;
      const id = String(serial).padStart(3, '0');
      const record = buildFn(serial);
      if (!record || typeof record !== 'object') {
        throw new Error('[archive-store] buildFn must return a memory record');
      }
      const toStore = Object.assign({}, record, { id });
      await requestToPromise(stores.memories.put(toStore));
      await requestToPromise(stores.meta.put({ id: META_ID, nextSerial: serial + 1 }));
      return { memory: toStore, serial, next: serial + 1 };
    });
  }

  async function getAllMemories() {
    return withReadTransaction(async (stores) => {
      const list = await requestToPromise(stores.memories.getAll());
      return Array.isArray(list) ? list : [];
    });
  }

  async function getMeta() {
    return withWriteTransaction(async (stores) => ensureMeta(stores.meta));
  }

  /** Full DB snapshot for backup download. */
  async function exportSnapshot() {
    return withWriteTransaction(async (stores) => {
      const meta = await ensureMeta(stores.meta);
      const memories = await requestToPromise(stores.memories.getAll());
      return {
        version: 1,
        exportedAt: new Date().toISOString(),
        meta: { nextSerial: meta.nextSerial },
        memories: Array.isArray(memories) ? memories : [],
      };
    });
  }

  function downloadSnapshot(snapshot) {
    const day = (snapshot.exportedAt || new Date().toISOString()).slice(0, 10);
    const filename = `pgmr-archive-${day}.json`;
    const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return filename;
  }

  async function exportAndDownload() {
    const snapshot = await exportSnapshot();
    const filename = downloadSnapshot(snapshot);
    return { filename, snapshot };
  }

  global.ArchiveStore = {
    DB_NAME,
    INITIAL_NEXT_SERIAL,
    getNextSerial,
    advanceSerial,
    commitMemory,
    getAllMemories,
    getMeta,
    exportSnapshot,
    exportAndDownload,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
