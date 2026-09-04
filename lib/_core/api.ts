import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

const LOG = __DEV__ ? console.log.bind(console) : () => {};
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};

export async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Determine the auth method:
  // - Native platform: use stored session token as Bearer auth
  // - Web (including iframe): use cookie-based auth (browser handles automatically)
  //   Cookie is set on backend domain via POST /api/auth/session after receiving token via postMessage
  if (Platform.OS !== "web") {
    const sessionToken = await Auth.getSessionToken();
    LOG("[API] apiCall:", {
      endpoint,
      hasToken: !!sessionToken,
      method: options.method || "GET",
    });
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
      LOG("[API] Authorization header added");
    }
  } else {
    LOG("[API] apiCall:", {
      endpoint,
      platform: "web",
      method: options.method || "GET",
    });
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  LOG("[API] Full URL:", url);

  try {
    LOG("[API] Making request...");
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    LOG("[API] Response status:", response.status, response.statusText);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    LOG("[API] Response headers:", responseHeaders);

    // Check if Set-Cookie header is present (cookies are automatically handled in React Native)
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      LOG("[API] Set-Cookie header received:", setCookie);
    }

    if (!response.ok) {
      const errorText = await response.text();
      LOG_ERROR("[API] Error response:", errorText);
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        // Not JSON, use text as is
      }
      throw new Error(
        errorMessage || `API call failed: ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      LOG("[API] JSON response received");
      return data as T;
    }

    const text = await response.text();
    LOG("[API] Text response received");
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    LOG_ERROR("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// OAuth callback handler - redeem a single-use server ticket for a session.
// Calls /api/auth/oauth/consume which returns JSON with sessionToken and user.
// (The legacy /api/oauth/mobile endpoint no longer exists.)
export async function exchangeOAuthCode(
  ticket: string,
  deviceId?: string,
): Promise<{ sessionToken: string; user: any }> {
  LOG("[API] exchangeOAuthCode called");
  const { redeemOAuthTicket } = await import("@/lib/oauth-callback");
  const { getApiBaseUrl } = await import("@/constants/oauth");
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("API base URL is not configured");
  const result = await redeemOAuthTicket(ticket, { baseUrl, deviceId });
  LOG("[API] OAuth exchange result:", {
    hasSessionToken: !!result.sessionToken,
    hasUser: !!result.user,
  });
  return result;
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    LOG_ERROR("[API] getMe failed:", error);
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  try {
    LOG("[API] establishSession: setting cookie on backend...");
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      LOG_ERROR("[API] establishSession failed:", response.status);
      return false;
    }

    LOG("[API] establishSession: cookie set successfully");
    return true;
  } catch (error) {
    LOG_ERROR("[API] establishSession error:", error);
    return false;
  }
}
