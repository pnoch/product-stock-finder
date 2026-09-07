import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "has_seen_onboarding";

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export async function hasSeenOnboarding(
  store: KeyValueStore = AsyncStorage,
): Promise<boolean> {
  try {
    return (await store.getItem(KEY)) === "true";
  } catch {
    return true;
  }
}

export async function setOnboardingSeen(
  store: KeyValueStore = AsyncStorage,
): Promise<void> {
  try {
    await store.setItem(KEY, "true");
  } catch {
    // Best-effort persistence.
  }
}
