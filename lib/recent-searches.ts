import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "recent_searches";

export const MAX_RECENT_SEARCHES = 8;

export function parseRecentSearches(raw: string | null): string[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(list: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return list;
  const filtered = list.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
}

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export async function getRecentSearches(store: KeyValueStore = AsyncStorage): Promise<string[]> {
  try {
    return parseRecentSearches(await store.getItem(KEY));
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
  const updated = addRecentSearch(await getRecentSearches(store), trimmed);
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
