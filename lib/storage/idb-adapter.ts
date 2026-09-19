import type { StorageAdapter } from "./adapter";

const DB_NAME = "psf-storage";
const STORE_NAME = "kv";
const DB_VERSION = 1;

// Marker so callers can tell "IDB is not usable here" (fall back to
// localStorage) apart from "the IDB operation failed" (must surface).
class IdbUnavailableError extends Error {}

function openDB(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new IdbUnavailableError("indexedDB unavailable"));
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
        let result: T;
        let settled = false;
        req.onsuccess = () => {
          result = req.result as T;
          // For reads the request result is the answer; for writes we wait for
          // the transaction to commit so a commit-time abort (quota, teardown)
          // is surfaced instead of silently losing the write.
          if (mode === "readonly") {
            settled = true;
            resolve(result);
          }
        };
        req.onerror = () => {
          settled = true;
          reject((req as any).error ?? new Error("indexedDB request failed"));
        };
        tx.oncomplete = () => {
          db.close();
          if (!settled) resolve(result);
        };
        tx.onerror = () => {
          db.close();
          if (!settled) {
            settled = true;
            reject((tx as any).error ?? new Error("indexedDB transaction failed"));
          }
        };
        tx.onabort = () => {
          db.close();
          if (!settled) {
            settled = true;
            reject((tx as any).error ?? new Error("indexedDB transaction aborted"));
          }
        };
      }),
  );
}

function readLocalStorage(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch (e) {
    console.warn("[idb-adapter] localStorage write failed", e);
  }
}

function removeLocalStorage(key: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
  } catch (e) {
    console.warn("[idb-adapter] localStorage remove failed", e);
  }
}

export function createIDBAdapter(): StorageAdapter {
  return {
    async getItem(key: string): Promise<string | null> {
      let idbValue: string | null = null;
      try {
        const result = await withStore<{ key: string; value: string } | undefined>("readonly", (s) =>
          s.get(key),
        );
        idbValue = result?.value ?? null;
      } catch {
        // IDB unavailable this call — fall back to localStorage only.
        return readLocalStorage(key);
      }
      if (idbValue !== null) return idbValue;
      // IDB miss: the value may predate the IndexedDB switch (AsyncStorage on
      // web is localStorage-backed) or have been written by the fallback path
      // below. Adopt it into IDB so subsequent reads are consistent, and keep
      // the localStorage copy until the write succeeds.
      const legacy = readLocalStorage(key);
      if (legacy === null) return null;
      try {
        await withStore("readwrite", (s) => s.put({ key, value: legacy }));
        removeLocalStorage(key);
      } catch {
        // Migration write failed; still return the value so the app works.
      }
      return legacy;
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        await withStore("readwrite", (s) => s.put({ key, value }));
        // Keep the two stores from diverging if a legacy copy exists.
        removeLocalStorage(key);
      } catch {
        writeLocalStorage(key, value);
      }
    },
    async removeItem(key: string): Promise<void> {
      // Only drop the localStorage copy once the IDB delete has committed.
      // Deleting it after a failed IDB delete left the stale IDB value in place
      // (getItem prefers IDB), so the deleted data resurrected on the next read.
      try {
        await withStore("readwrite", (s) => s.delete(key));
      } catch (e) {
        if (!(e instanceof IdbUnavailableError)) throw e;
        // IDB unusable: localStorage is the only store, so delete there.
      }
      removeLocalStorage(key);
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
          tx.onabort = () => {
            db.close();
            reject((tx as any).error ?? new Error("multiRemove aborted"));
          };
        });
      } catch (e) {
        if (!(e instanceof IdbUnavailableError)) throw e;
      }
      keys.forEach(removeLocalStorage);
    },
  };
}

export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined" && typeof window !== "undefined";
}
