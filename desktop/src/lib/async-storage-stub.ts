// Desktop build stub — desktop uses its own storage (src/storage).
// Shared lib modules transitively import AsyncStorage; this stub keeps the
// Vite bundle free of react-native.
//
// It is backed by localStorage (NOT a module-level Map) so shared modules
// share the SAME store as desktop/src/storage.ts. A private Map made
// `defaultStorage` a throwaway: e.g. llm-discovery wrote discovered products
// there while the UI read them from the desktop store, so they were lost.
const noop = () => Promise.resolve();
const fallback = new Map<string, string>();

function ls(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export default {
  getItem: async (key: string) => ls()?.getItem(key) ?? fallback.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    const l = ls();
    if (l) l.setItem(key, value);
    else fallback.set(key, value);
  },
  removeItem: async (key: string) => {
    ls()?.removeItem(key);
    fallback.delete(key);
  },
  multiRemove: async (keys: string[]) => {
    const l = ls();
    keys.forEach((k) => {
      l?.removeItem(k);
      fallback.delete(k);
    });
  },
  multiGet: async (keys: string[]) =>
    keys.map(
      (k) => [k, ls()?.getItem(k) ?? fallback.get(k) ?? null] as [string, string | null],
    ),
  getAllKeys: async () =>
    ls() ? Object.keys(ls()!) : Array.from(fallback.keys()),
  clear: async () => {
    ls()?.clear();
    fallback.clear();
  },
};
export const _noop = noop;