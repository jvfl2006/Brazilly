(() => {
  'use strict';

  const DB_NAME = 'brazilly-client-cache';
  const DB_VERSION = 1;
  const STORE = 'entries';
  const memory = new Map();
  const pending = new Map();
  let databasePromise;

  function openDatabase() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(resolve => {
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch { resolve(null); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return databasePromise;
  }

  async function read(key) {
    const db = await openDatabase();
    if (!db) return null;
    return new Promise(resolve => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async function write(entry) {
    const db = await openDatabase();
    if (!db) return false;
    return new Promise(resolve => {
      try {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  }

  async function remove(key) {
    memory.delete(key);
    const db = await openDatabase();
    if (!db) return;
    try {
      await new Promise(resolve => {
        const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key);
        request.onsuccess = request.onerror = () => resolve();
      });
    } catch {}
  }

  async function get(key) {
    const now = Date.now();
    const local = memory.get(key);
    if (local && local.expiresAt > now) return local.value;
    if (local) memory.delete(key);

    const stored = await read(key);
    if (!stored) return undefined;
    if (!Number.isFinite(stored.expiresAt) || stored.expiresAt <= now) {
      remove(key);
      return undefined;
    }
    memory.set(key, stored);
    return stored.value;
  }

  async function set(key, value, ttlMs) {
    const entry = { key, value, expiresAt: Date.now() + Math.max(0, ttlMs), updatedAt: Date.now() };
    memory.set(key, entry);
    await write(entry);
    return value;
  }

  async function getOrLoad(key, loader, options = {}) {
    if (typeof key !== 'string' || !key || typeof loader !== 'function') {
      throw new TypeError('Chave e função de carregamento são obrigatórias.');
    }
    const cached = await get(key);
    if (cached !== undefined) return cached;
    if (pending.has(key)) return pending.get(key);

    const task = (async () => {
      const value = await loader();
      if (value !== undefined && value !== null && options.ttlMs > 0) {
        await set(key, value, options.ttlMs);
      }
      return value;
    })();
    pending.set(key, task);
    try { return await task; }
    finally { if (pending.get(key) === task) pending.delete(key); }
  }

  async function invalidate(key) { await remove(key); }

  async function clear(prefix = '') {
    for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
    const db = await openDatabase();
    if (!db) return;
    try {
      await new Promise(resolve => {
        const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) { resolve(); return; }
          if (cursor.key.startsWith(prefix)) cursor.delete();
          cursor.continue();
        };
        request.onerror = () => resolve();
      });
    } catch {}
  }

  window.BrazillyCache = Object.freeze({ get, set, getOrLoad, invalidate, clear });
})();