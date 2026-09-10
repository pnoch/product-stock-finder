import type { StorageAdapter } from "./adapter";

const DB_NAME = "psf-storage";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function openDB(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject((req as any).error ?? new Error("indexedDB open failed"));
  });
}

function withStore<T>(mode: string, fn: (store: any) => any): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject((req as any).error ?? new Error("indexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject((tx as any).error ?? new Error("indexedDB transaction failed"));
        };
      }),
  );
}

export function createIDBAdapter(): StorageAdapter {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const result = await withStore<{ key: string; value: string } | undefined>("readonly", (s) =>
          s.get(key),
        );
        return result?.value ?? null;
      } catch {
        try {
          return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
        } catch {
          return null;
        }
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        await withStore("readwrite", (s) => s.put({ key, value }));
      } catch {
        try {
          if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        } catch (e) {
          console.warn("[idb-adapter] setItem fallback failed", e);
          throw e;
        }
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        await withStore("readwrite", (s) => s.delete(key));
      } catch {
        try {
          if (typeof localStorage !== "undefined") localStorage.removeItem(key);
        } catch (e) {
          console.warn("[idb-adapter] removeItem fallback failed", e);
          throw e;
        }
      }
    },
    async multiRemove(keys: string[]): Promise<void> {
      try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          for (const k of keys) store.delete(k);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject((tx as any).error ?? new Error("multiRemove failed"));
          };
        });
      } catch {
        try {
          if (typeof localStorage !== "undefined") keys.forEach((k) => localStorage.removeItem(k));
        } catch (e) {
          console.warn("[idb-adapter] multiRemove fallback failed", e);
          throw e;
        }
      }
    },
  };
}

export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined" && typeof window !== "undefined";
}
