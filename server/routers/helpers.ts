const LOCAL_ORIGIN_FALLBACK = "http://localhost:8081";

function cleanHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/$/, "");
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Share URLs must never be built from attacker-controlled Origin/Referer
// headers (phishing via a poisoned link host). Only deployment config is
// trusted; otherwise fall back to localhost.
export function getOrigin(_req?: unknown): string {
  void _req;
  const envWeb = cleanHttpUrl(process.env.EXPO_PUBLIC_WEB_URL);
  if (envWeb) return envWeb;
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envApi) {
    try {
      const u = new URL(envApi.trim());
      if (u.protocol === "http:" || u.protocol === "https:") {
        if (u.port === "3000") u.port = "8081";
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      // fall through to localhost
    }
  }
  return LOCAL_ORIGIN_FALLBACK;
}
