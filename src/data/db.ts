// Envoltorio mínimo de IndexedDB, sin dependencias.
// Almacenes:
//  - kv: ajustes y estado de la app (clave → valor)
//  - images: imágenes de personajes importadas por el usuario (clave "ruta-nivel" → Blob)

const DB_NAME = 'lifepath';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

type StoreName = 'kv' | 'images';

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kv = {
  get: <T>(key: string) => run<T | undefined>('kv', 'readonly', (s) => s.get(key)),
  set: (key: string, value: unknown) => run<IDBValidKey>('kv', 'readwrite', (s) => s.put(value, key)),
  del: (key: string) => run<undefined>('kv', 'readwrite', (s) => s.delete(key))
};

export const imageDb = {
  get: (key: string) => run<Blob | undefined>('images', 'readonly', (s) => s.get(key)),
  put: (key: string, blob: Blob) => run<IDBValidKey>('images', 'readwrite', (s) => s.put(blob, key)),
  del: (key: string) => run<undefined>('images', 'readwrite', (s) => s.delete(key)),
  keys: () => run<IDBValidKey[]>('images', 'readonly', (s) => s.getAllKeys()),
  clear: () => run<undefined>('images', 'readwrite', (s) => s.clear())
};
