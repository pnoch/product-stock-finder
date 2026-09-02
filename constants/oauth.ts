import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: "productstockfinder",
};

export const API_BASE_URL = env.apiBaseUrl;

export function getApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL.replace(/\/$/, "");

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
  if (ReactNative.Platform.OS === "web") return `${getApiBaseUrl()}/api/auth/callback`;
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
    if (deviceId) params.set("deviceId", deviceId);
    const res = await fetch(`${baseUrl}/api/auth/oauth/start?${params.toString()}`, {
      headers: deviceId ? { "X-Device-Id": deviceId } : undefined,
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
