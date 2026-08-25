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

export async function getDesktopDeviceId(): Promise<string> {
  let id = await localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    await localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
