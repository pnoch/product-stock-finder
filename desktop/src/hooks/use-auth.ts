import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getAppId, getOAuthPortalUrl } from "../lib/api-base";

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
          // ignore malformed user payload; the token is still valid
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
    isAuthenticated: Boolean(user),
    login,
    logout,
  };
}
