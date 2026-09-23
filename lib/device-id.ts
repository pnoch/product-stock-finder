import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "device_id";

let pending: Promise<string> | null = null;
// Fallback id for a storage failure (browser privacy modes). Cached in memory
// so the device keeps a stable identity for the session: generating a new id
// per call made the server see a different device on every request (breaking
// device binding/revocation).
let memoryFallbackId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = generateId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      return id;
    } catch {
      if (!memoryFallbackId) memoryFallbackId = generateId();
      return memoryFallbackId;
    }
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
