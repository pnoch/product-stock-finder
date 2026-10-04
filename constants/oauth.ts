import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

// Static member access is required: Expo's env plugin only inlines literal
// `process.env.EXPO_PUBLIC_*` expressions, and the Vite-style meta-env syntax
// is unsupported by Hermes (native) and breaks the classic-script web bundle.
// The desktop build aliases this module away, so only the Expo path matters.
const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: "productstockfinder",
};

export const API_BASE_URL = env.apiBaseUrl;

// A loopback API base (localhost / 127.0.0.1 / ::1 / the Android emulator alias)
// only resolves in development — via `adb reverse` or the emulator. A release
// build that baked one in (e.g. the dev `.env`) is effectively standalone:
// treating it as configured made the app try, and fail, to reach the device's
// own localhost instead of running local-only (prices from on-device scraping).
function isLoopbackApiBase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "10.0.2.2"
    );
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    if (!__DEV__ && isLoopbackApiBase(API_BASE_URL)) return "";
    return API_BASE_URL.replace(/\/$/, "");
  }

  if (
    ReactNative.Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    const { protocol, hostname } = window.location;
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) return `${protocol}//${apiHostname}`;
  }

  return "";
}

export function isServerConfigured(): boolean {
  return getApiBaseUrl() !== "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "user_info";

export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    // The SPA route (same-origin), NOT an API path: the server sets the session
    // cookie and redirects here. `/api/auth/callback` does not exist.
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : getApiBaseUrl();
    return `${origin}/oauth/callback`;
  }
  return Linking.createURL("/oauth/callback", { scheme: env.deepLinkScheme });
};

export async function getLoginUrl(): Promise<string> {
  return `${getApiBaseUrl()}/api/auth/login`;
}

export type OAuthProvider = "google" | "apple";

export async function getOAuthUrl(provider: OAuthProvider): Promise<string | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return null;
  try {
    let deviceId: string | undefined;
    try {
      const { getDeviceId } = await import("@/lib/device-id");
      deviceId = await getDeviceId();
    } catch {
      deviceId = undefined;
    }
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({ provider });
    if (redirectUri) params.set("redirectUri", redirectUri);
    // On web the server issues a cookie session; sending a deviceId would make
    // it take the native ticket branch instead (no cookie, wrong redirect).
    if (deviceId && ReactNative.Platform.OS !== "web") {
      params.set("deviceId", deviceId);
    }
    // The server also reads the device id from this header, which would force
    // the native ticket branch on web (no cookie, custom-scheme redirect).
    const sendDeviceHeader =
      Boolean(deviceId) && ReactNative.Platform.OS !== "web";
    const res = await fetch(`${baseUrl}/api/auth/oauth/start?${params.toString()}`, {
      headers: sendDeviceHeader
        ? { "X-Device-Id": deviceId as string }
        : undefined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}

export async function startOAuthLogin(provider: OAuthProvider = "google"): Promise<string | null> {
  return getOAuthUrl(provider);
}
