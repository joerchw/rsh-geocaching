// IndexedDB-backed progress: done-status + photos per cache id.
// Falls back to in-memory if IndexedDB is unavailable, so the app never crashes.

const DB_NAME = 'rsh-geocaching';
const DB_VERSION = 1;
const STORE_PROGRESS = 'progress'; // key: cacheId -> { done, doneAt }
const STORE_PHOTOS = 'photos';     // key: auto -> { cacheId, blob, createdAt }

let dbPromise = null;
const memory = { progress: new Map(), photos: [] };
let useMemory = false;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      useMemory = true;
      reject(new Error('IndexedDB nicht verfügbar'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS);
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        const s = db.createObjectStore(STORE_PHOTOS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('byCache', 'cacheId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { useMemory = true; reject(req.error); };
  });
  return dbPromise;
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

export async function markDone(cacheId) {
  const record = { done: true, doneAt: new Date().toISOString() };
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const r = tx(db, STORE_PROGRESS, 'readwrite').put(record, cacheId);
      r.onsuccess = res; r.onerror = () => rej(r.error);
    });
  } catch {
    useMemory = true;
    memory.progress.set(cacheId, record);
  }
}

export async function isDone(cacheId) {
  try {
    if (useMemory) return memory.progress.get(cacheId)?.done === true;
    const db = await openDb();
    return await new Promise((res) => {
      const r = tx(db, STORE_PROGRESS, 'readonly').get(cacheId);
      r.onsuccess = () => res(r.result?.done === true);
      r.onerror = () => res(false);
    });
  } catch {
    return memory.progress.get(cacheId)?.done === true;
  }
}

export async function getDoneIds() {
  try {
    if (useMemory) {
      return new Set([...memory.progress.entries()].filter(([, v]) => v.done).map(([k]) => k));
    }
    const db = await openDb();
    return await new Promise((res) => {
      const ids = new Set();
      const store = tx(db, STORE_PROGRESS, 'readonly');
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          if (cursor.value?.done) ids.add(cursor.key);
          cursor.continue();
        } else {
          res(ids);
        }
      };
      cursorReq.onerror = () => res(ids);
    });
  } catch {
    return new Set();
  }
}

export async function addPhoto(cacheId, blob) {
  const record = { cacheId, blob, createdAt: new Date().toISOString() };
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const r = tx(db, STORE_PHOTOS, 'readwrite').add(record);
      r.onsuccess = res; r.onerror = () => rej(r.error);
    });
  } catch {
    useMemory = true;
    memory.photos.push(record);
  }
}

export async function getPhotos(cacheId) {
  try {
    if (useMemory) return memory.photos.filter((p) => p.cacheId === cacheId).map((p) => p.blob);
    const db = await openDb();
    return await new Promise((res) => {
      const blobs = [];
      const index = tx(db, STORE_PHOTOS, 'readonly').index('byCache');
      const cursorReq = index.openCursor(IDBKeyRange.only(cacheId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) { blobs.push(cursor.value.blob); cursor.continue(); }
        else { res(blobs); }
      };
      cursorReq.onerror = () => res(blobs);
    });
  } catch {
    return memory.photos.filter((p) => p.cacheId === cacheId).map((p) => p.blob);
  }
}
