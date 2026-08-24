import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "recent_searches";
const MAX_ENTRIES = 8;

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function getRecentSearches(
  store: KeyValueStore = AsyncStorage,
): Promise<string[]> {
  try {
    const raw = await store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export async function recordSearch(
  query: string,
  store: KeyValueStore = AsyncStorage,
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches(store);
  const list = await getRecentSearches(store);
  const filtered = list.filter(
    (q) => q.toLowerCase() !== trimmed.toLowerCase(),
  );
  const updated = [trimmed, ...filtered].slice(0, MAX_ENTRIES);
  try {
    await store.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Best-effort persistence.
  }
  return updated;
}

export async function clearRecentSearches(
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    await store.removeItem(KEY);
  } catch {
    // Best-effort persistence.
  }
}
