// Desktop build stub — desktop uses its own storage (src/storage).
// Shared lib modules transitively import AsyncStorage; this stub keeps
// the Vite bundle free of react-native.
const noop = () => Promise.resolve();
const store = new Map<string, string>();
export default {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: async (key: string) => {
    store.delete(key);
  },
  multiRemove: async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  },
  multiGet: async (keys: string[]) =>
    keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
  getAllKeys: async () => Array.from(store.keys()),
  clear: async () => {
    store.clear();
  },
};
export const _noop = noop;