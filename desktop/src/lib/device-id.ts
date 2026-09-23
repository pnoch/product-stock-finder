const DEVICE_ID_KEY = "device_id";

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let pending: Promise<string> | null = null;
// Fallback id for a storage failure. Cached in memory so the device keeps a
// stable identity for the session (a new id per call made the server see a
// different device on every request).
let memoryFallbackId: string | null = null;

export async function getDesktopDeviceId(): Promise<string> {
  if (pending) return pending;
  pending = (async () => {
    try {
      // `await` works for both the synchronous browser localStorage and the
      // async test adapter.
      const existing = await localStorage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const newId = generateId();
      await localStorage.setItem(DEVICE_ID_KEY, newId);
      return newId;
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
