export interface AudioEntry {
  id?: number;
  name: string;
  blob: Blob;
  size: number;
  createdAt: number;
}

const DB_NAME = "timerius3000";
const DB_VERSION = 1;
const STORE = "audio";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllAudio(): Promise<AudioEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as AudioEntry[]);
    req.onerror = () => reject(req.error);
  });
}

export async function addAudio(name: string, blob: Blob): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const entry: AudioEntry = { name, blob, size: blob.size, createdAt: Date.now() };
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function getAudio(id: number): Promise<AudioEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as AudioEntry | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudio(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
