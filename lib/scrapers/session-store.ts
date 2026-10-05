import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "session_unlocked";

// The set of distributors the user has explicitly unlocked (id -> ISO time).
// We persist intent rather than inferring from cookies, because distributor
// sites set analytics/consent cookies regardless of a login.
export async function getUnlocked(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export async function markUnlocked(id: string): Promise<void> {
  try {
    const current = await getUnlocked();
    current[id] = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // best-effort
  }
}

export async function clearUnlocked(id: string): Promise<void> {
  try {
    const current = await getUnlocked();
    delete current[id];
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // best-effort
  }
}

export async function clearAllUnlocked(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
