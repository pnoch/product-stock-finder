import { createStorage } from "../../lib/storage";

const localStorageAdapter = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) =>
    localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
  multiRemove: async (keys: string[]) =>
    keys.forEach((k) => localStorage.removeItem(k)),
};

export const storage = createStorage(localStorageAdapter);
export const storageAdapter = localStorageAdapter;
