import { getDeviceId } from "@/lib/device-id";
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

const bundleId = "com.app.stock_tracker_pro";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
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
export const USER_INFO_KEY = "manus-runtime-user-info";

export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") return `${getApiBaseUrl()}/api/auth/callback`;
  return Linking.createURL("/oauth/callback", { scheme: env.deepLinkScheme });
};

export async function getLoginUrl(): Promise<string> {
  return `${getApiBaseUrl()}/api/auth/login`;
}

export async function startOAuthLogin(): Promise<string | null> {
  return null;
}
