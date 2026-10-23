import type { StorageAdapter } from "../../../lib/storage/adapter";

// One adapter for every desktop caller that needs the shared storage helpers
// (health service, breaker store, notes, onboarding). Keeping five copies made
// it easy for one to drift (e.g. missing `multiRemove`).
export const localStorageAdapter: StorageAdapter = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
  multiRemove: async (keys: string[]) =>
    keys.forEach((key) => localStorage.removeItem(key)),
};
