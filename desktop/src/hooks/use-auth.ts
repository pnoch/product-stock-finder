import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getApiBaseUrl, getAppId, getOAuthPortalUrl } from "../lib/api-base";

const SESSION_TOKEN_KEY = "desktop_session_token";
const USER_INFO_KEY = "desktop_user_info";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
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

export function buildLoginUrl(): string {
  const portal = getOAuthPortalUrl();
  if (!portal) return "";
  const redirectUri = "http://localhost:3420/callback";
  const url = new URL(`${portal}/app-auth`);
  url.searchParams.set("appId", getAppId());
  url.searchParams.set("redirectUri", redirectUri);
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

function mapUser(data: {
  id?: number;
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: string;
}): User {
  return {
    id: data.id ?? 0,
    openId: data.openId ?? "",
    name: data.name ?? null,
    email: data.email ?? null,
    loginMethod: data.loginMethod ?? null,
    lastSignedIn: data.lastSignedIn ?? new Date().toISOString(),
  };
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
      const result = await invoke<{ sessionToken: string; user: string }>(
        "start_oauth",
        { loginUrl },
      );
      if (!result?.sessionToken) {
        setError("Sign-in failed: no session token returned");
        return false;
      }
      setSessionToken(result.sessionToken);
      if (result.user) {
        try {
          const decoded = JSON.parse(atob(result.user)) as {
            id?: number;
            openId?: string;
            name?: string | null;
            email?: string | null;
            loginMethod?: string | null;
            lastSignedIn?: string;
          };
          setUserInfo({
            id: decoded.id ?? 0,
            openId: decoded.openId ?? "",
            name: decoded.name ?? null,
            email: decoded.email ?? null,
            loginMethod: decoded.loginMethod ?? null,
            lastSignedIn: decoded.lastSignedIn ?? new Date().toISOString(),
          });
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

  const logout = useCallback(() => {
    removeSessionToken();
    clearUserInfo();
    notify();
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
