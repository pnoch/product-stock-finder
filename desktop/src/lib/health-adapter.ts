import type { StorageAdapter } from "../../../lib/storage/adapter";

export const localAdapter: StorageAdapter = {
  getItem: async (k: string) => localStorage.getItem(k),
  setItem: async (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: async (k: string) => localStorage.removeItem(k),
  multiRemove: async (keys: string[]) => keys.forEach((k) => localStorage.removeItem(k)),
};
