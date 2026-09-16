import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "device_id";

let pending: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (pending) return pending;
  pending = (async () => {
    // Storage can throw (browser privacy modes); fall back to an in-memory id
    // rather than rejecting every tRPC request that awaits this.
    try {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = generateId();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      return id;
    } catch {
      return generateId();
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
