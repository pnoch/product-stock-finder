import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl, getAppId, getOAuthPortalUrl } from "../lib/api-base";
import { getDesktopDeviceId } from "../lib/device-id";
import { unregisterServerToken, PENDING_UNREGISTER_KEY } from "../lib/push-unregister";

const SESSION_TOKEN_KEY = "desktop_session_token";
const USER_INFO_KEY = "desktop_user_info";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  emailVerified?: boolean | null;
  loginMethod: string | null;
  lastSignedIn: string;
};

export function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function removeSessionToken(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
}

export function getUserInfo(): User | null {
  const raw = localStorage.getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUserInfo(user: User): void {
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}

export function clearUserInfo(): void {
  localStorage.removeItem(USER_INFO_KEY);
}

export async function buildLoginUrl(): Promise<string> {
  const portal = getOAuthPortalUrl();
  if (!portal) return "";
  const redirectUri = "http://localhost:3420/callback";
  // A deviceId makes the server issue a device-bound ticket (and marks the
  // callback native) instead of a cookie-based web session.
  const deviceId = await getDesktopDeviceId().catch(() => undefined);
  const url = new URL(`${portal}/app-auth`);
  url.searchParams.set("appId", getAppId());
  url.searchParams.set("redirectUri", redirectUri);
  if (deviceId) url.searchParams.set("deviceId", deviceId);
  url.searchParams.set("state", btoa(redirectUri));
  url.searchParams.set("type", "signIn");
  return url.toString();
}

export async function buildWebLoginUrl(): Promise<string> {
  const portal = getOAuthPortalUrl();
  if (!portal) return "";
  const deviceId = await getDesktopDeviceId().catch(() => undefined);
  const redirectUri = `${window.location.origin}/#/oauth/callback`;
  const url = new URL(`${portal}/app-auth`);
  url.searchParams.set("appId", getAppId());
  url.searchParams.set("redirectUri", redirectUri);
  if (deviceId) url.searchParams.set("deviceId", deviceId);
  url.searchParams.set("state", btoa(redirectUri));
  url.searchParams.set("type", "signIn");
  return url.toString();
}

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function mapUser(data: {
  id?: number;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  emailVerified?: number | boolean | null;
  loginMethod?: string | null;
  lastSignedIn?: string;
}): User {
  return {
    id: data.id ?? 0,
    openId: data.openId ?? "",
    name: data.name ?? null,
    email: data.email ?? null,
    emailVerified: data.emailVerified == null ? null : Boolean(data.emailVerified),
    loginMethod: data.loginMethod ?? null,
    lastSignedIn: data.lastSignedIn ?? new Date().toISOString(),
  };
}

export function validateEmailAuth(email: string, password: string, isRegister: boolean): string | null {
  if (!email || !email.includes("@") || !password) {
    return "Email and password are required";
  }
  if (isRegister && password.length < 6) {
    return "Password must be at least 6 characters";
  }
  return null;
}

export function validateForgotEmail(email: string): string | null {
  if (!email || !email.includes("@")) {
    return "Email is required";
  }
  return null;
}

export function validatePasswordChange(currentPw: string, newPw: string, confirmPw: string): string | null {
  if (!currentPw || !newPw || !confirmPw) {
    return "All fields are required";
  }
  if (newPw.length < 6) {
    return "New password must be at least 6 characters";
  }
  if (newPw !== confirmPw) {
    return "New passwords do not match";
  }
  return null;
}

async function authedFetch<T>(
  path: string,
  body: unknown,
  opts?: { token?: string | null; fallbackError?: string },
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("Server not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = opts?.token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || opts?.fallbackError || "Request failed");
  }
  return (await res.json()) as T;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const data = await authedFetch<{ sessionToken?: string; user?: Parameters<typeof mapUser>[0] }>(
    "/api/auth/login",
    { email, password },
    { fallbackError: "Login failed" },
  );
  if (data.sessionToken) setSessionToken(data.sessionToken);
  if (data.user) setUserInfo(mapUser(data.user));
  notify();
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<void> {
  const data = await authedFetch<{ sessionToken?: string; user?: Parameters<typeof mapUser>[0] }>(
    "/api/auth/register",
    { email, password, name },
    { fallbackError: "Registration failed" },
  );
  if (data.sessionToken) setSessionToken(data.sessionToken);
  if (data.user) setUserInfo(mapUser(data.user));
  notify();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authedFetch<{ success?: boolean }>(
    "/api/auth/change-password",
    { currentPassword, newPassword },
    { token: getSessionToken(), fallbackError: "Change password failed" },
  );
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await authedFetch<{ success?: boolean }>(
    "/api/auth/reset",
    { token, newPassword },
    { fallbackError: "Password reset failed" },
  );
}

export async function resendVerification(): Promise<void> {
  await authedFetch<{ success?: boolean }>(
    "/api/auth/resend-verification",
    {},
    { token: getSessionToken(), fallbackError: "Resend verification failed" },
  );
}

export async function deleteAccount(): Promise<void> {
  await authedFetch<{ success?: boolean }>(
    "/api/auth/delete-account",
    { confirm: "DELETE" },
    { token: getSessionToken(), fallbackError: "Server account deletion failed" },
  );
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => getUserInfo());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAuth(() => {
      setUser(getUserInfo());
      setError(null);
    });
  }, []);

  const login = useCallback(async (loginUrl: string) => {
    if (!loginUrl) {
      setError("OAuth portal is not configured");
      return false;
    }
    setLoading(true);
    setError(null);
    try {
      const isTauri =
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI__?: unknown }).__TAURI__;
      if (!isTauri) {
        const webUrl = await buildWebLoginUrl();
        if (!webUrl) {
          setError("OAuth portal is not configured");
          return false;
        }
        window.location.href = webUrl;
        return true;
      }
      const result = await invoke<{ ticket: string }>(
        "start_oauth",
        { loginUrl },
      );
      if (!result?.ticket) {
        setError("Sign-in failed: no ticket returned");
        return false;
      }
      // Redeem the single-use ticket server-side (never trust a raw token from
      // the callback URL).
      const { redeemOAuthTicket } = await import("../../../lib/oauth-callback");
      const deviceId = await getDesktopDeviceId().catch(() => undefined);
      const redeemed = await redeemOAuthTicket(result.ticket, {
        baseUrl: getApiBaseUrl(),
        deviceId,
      });
      if (!redeemed?.sessionToken) {
        setError("Sign-in failed: no session token returned");
        return false;
      }
      setSessionToken(redeemed.sessionToken);
      if (redeemed.user) {
        try {
          setUserInfo(mapUser(redeemed.user as Parameters<typeof mapUser>[0]));
        } catch {
          // A token without a usable user profile must not leave a stale
          // signed-in session behind.
          removeSessionToken();
          clearUserInfo();
          setUser(null);
          setError("Sign-in failed: invalid user payload");
          return false;
        }
      }
      notify();
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Dynamic import: a static import of ../lib/trpc here would reintroduce
    // the use-auth ↔ trpc cycle that push-unregister was created to break.
    clearUserInfo();
    notify();
    try {
      const { createTRPCClient } = await import("../lib/trpc");
      const ok = await unregisterServerToken(createTRPCClient());
      if (!ok) localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
    } catch {
      localStorage.setItem(PENDING_UNREGISTER_KEY, "1");
    }
    removeSessionToken();
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: Boolean(user && getSessionToken()),
    login,
    logout,
  };
}
