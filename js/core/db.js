/* Fiction Studio — camada IndexedDB. Uma base local, registros isolados por projectId. */
'use strict';

const DB = {
  name: 'fiction-studio',
  version: 1,
  db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Este navegador não oferece IndexedDB.'));
      const req = indexedDB.open(DB.name, DB.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('entities')) {
          const s = db.createObjectStore('entities', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId');
          s.createIndex('pk', ['projectId', 'kind']);
        }
        if (!db.objectStoreNames.contains('relations')) {
          db.createObjectStore('relations', { keyPath: 'id' }).createIndex('projectId', 'projectId');
        }
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' }).createIndex('projectId', 'projectId');
        }
        for (const s of ['tags', 'templates', 'settings']) {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => { DB.db = req.result; resolve(DB.db); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('A base de dados está bloqueada por outra aba aberta.'));
    });
  },
  _req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  _tx(stores, mode = 'readonly') { return DB.db.transaction(stores, mode); },
  get(store, id) { return DB._req(DB._tx(store).objectStore(store).get(id)); },
  all(store) { return DB._req(DB._tx(store).objectStore(store).getAll()); },
  byProject(store, pid) { return DB._req(DB._tx(store).objectStore(store).index('projectId').getAll(pid)); },
  countKind(pid, kind) { return DB._req(DB._tx('entities').objectStore('entities').index('pk').count([pid, kind])); },
  countProject(store, pid) { return DB._req(DB._tx(store).objectStore(store).index('projectId').count(pid)); },
  put(store, obj) {
    return new Promise((res, rej) => {
      const tx = DB._tx(store, 'readwrite');
      tx.objectStore(store).put(obj);
      tx.oncomplete = () => res(obj); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Gravação abortada'));
    });
  },
  /* writes: [{store, op:'put'|'del', value|id}] numa única transação */
  batch(writes) {
    if (!writes.length) return Promise.resolve();
    const stores = U.uniq(writes.map(w => w.store));
    return new Promise((res, rej) => {
      const tx = DB._tx(stores, 'readwrite');
      for (const w of writes) {
        const os = tx.objectStore(w.store);
        if (w.op === 'del') os.delete(w.id); else os.put(w.value);
      }
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Gravação abortada (espaço insuficiente?)'));
    });
  },
  del(store, id) { return DB.batch([{ store, op: 'del', id }]); },
  async deleteProject(pid) {
    const writes = [{ store: 'projects', op: 'del', id: pid }];
    for (const s of ['entities', 'relations', 'images']) {
      const keys = await DB._req(DB._tx(s).objectStore(s).index('projectId').getAllKeys(pid));
      for (const id of keys) writes.push({ store: s, op: 'del', id });
    }
    return DB.batch(writes);
  },
  async estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { /* ignorado */ }
    return null;
  },
  async persist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* ignorado */ }
    return false;
  },
};
