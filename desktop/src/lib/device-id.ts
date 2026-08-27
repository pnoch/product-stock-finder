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

export async function getDesktopDeviceId(): Promise<string> {
  let id = await localStorage.getItem(DEVICE_ID_KEY);
  if (id) return id;
  if (pending) return pending;
  pending = (async () => {
    const newId = generateId();
    await localStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
