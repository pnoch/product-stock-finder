function btoaSafe(value: string): string {
  if (typeof globalThis.btoa === "function") return globalThis.btoa(value);
  const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
    | typeof Buffer
    | undefined;
  if (BufferImpl) return BufferImpl.from(value, "utf-8").toString("base64");
  return value;
}

function atobSafe(value: string): string {
  if (typeof globalThis.atob === "function") return globalThis.atob(value);
  const BufferImpl = (globalThis as Record<string, unknown>).Buffer as
    | typeof Buffer
    | undefined;
  if (BufferImpl) return BufferImpl.from(value, "base64").toString("utf-8");
  return value;
}

export function encodeOAuthState(
  redirectUri: string,
  deviceId?: string,
): string {
  return btoaSafe(JSON.stringify({ redirectUri, deviceId }));
}

export function decodeOAuthState(state: string): {
  redirectUri: string;
  deviceId: string | undefined;
} {
  const decoded = atobSafe(state);
  try {
    const parsed = JSON.parse(decoded) as {
      redirectUri?: string;
      deviceId?: string;
    };
    if (typeof parsed.redirectUri === "string") {
      return { redirectUri: parsed.redirectUri, deviceId: parsed.deviceId };
    }
  } catch {
    // fall through to the legacy plain-base64 form
  }
  return { redirectUri: decoded, deviceId: undefined };
}
