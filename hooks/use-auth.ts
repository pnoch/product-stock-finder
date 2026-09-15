import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

const debugLog = (...args: unknown[]) => {
  if (!__DEV__) return;
  console.log(...args);
};

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    debugLog("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        debugLog("[useAuth] Web platform: fetching user from API...");
        const apiUser = await Api.getMe();

        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
            emailVerified: (apiUser as any).emailVerified ?? false,
          };
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          debugLog("[useAuth] Web user set from API");
        } else {
          debugLog("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        return;
      }

      // Native platform: use token-based auth
      debugLog("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      debugLog(
        "[useAuth] Session token:",
        sessionToken ? "present" : "missing",
      );
      if (!sessionToken) {
        debugLog("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      debugLog("[useAuth] Cached user:", cachedUser ? "present" : "absent");
      if (cachedUser) {
        debugLog("[useAuth] Using cached user info");
        setUser(cachedUser);
      } else {
        debugLog("[useAuth] No cached user, setting user to null");
        setUser(null);
      }
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      setUser(null);
    } finally {
      setLoading(false);
      debugLog("[useAuth] fetchUser completed");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Retract the server-side push binding first: otherwise the account's
      // alerts keep being pushed to this now-signed-out device.
      const { unregisterPushToken } = await import("@/lib/push-token");
      await unregisterPushToken();
    } catch (err) {
      console.error("[Auth] Push unregister failed:", err);
    }
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }
      const data = await res.json();
      if (data.sessionToken && Platform.OS !== "web") {
        await Auth.setSessionToken(data.sessionToken);
      }
      if (data.user) {
        const userInfo: Auth.User = {
          id: data.user.id,
          openId: data.user.openId,
          name: data.user.name,
          email: data.user.email,
          loginMethod: "email",
          lastSignedIn: new Date(),
          emailVerified: data.user.emailVerified ?? false,
        };
        await Auth.setUserInfo(userInfo);
        setUser(userInfo);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error("Login failed");
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Registration failed");
      }
      const data = await res.json();
      if (data.sessionToken && Platform.OS !== "web") {
        await Auth.setSessionToken(data.sessionToken);
      }
      if (data.user) {
        const userInfo: Auth.User = {
          id: data.user.id,
          openId: data.user.openId,
          name: data.user.name,
          email: data.user.email,
          loginMethod: "email",
          lastSignedIn: new Date(),
          emailVerified: data.user.emailVerified ?? false,
        };
        await Auth.setUserInfo(userInfo);
        setUser(userInfo);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error("Registration failed");
    }
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to send reset email");
    }
    return res.json();
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Password reset failed");
    }
    return res.json();
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (Platform.OS !== "web") {
      const token = await Auth.getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Change password failed");
    }
    return res.json();
  }, []);

  const deleteAccount = useCallback(async (confirm: string = "DELETE") => {
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (Platform.OS !== "web") {
      const token = await Auth.getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
      method: "POST",
      headers,
      body: JSON.stringify({ confirm }),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Delete account failed");
    }
    await Auth.removeSessionToken();
    await Auth.clearUserInfo();
    setUser(null);
    return res.json();
  }, []);

  const resendVerification = useCallback(async () => {
    const baseUrl = getApiBaseUrl();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (Platform.OS !== "web") {
      const token = await Auth.getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
      credentials: "include",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to resend verification email");
    }
    return res.json();
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    debugLog(
      "[useAuth] useEffect triggered, autoFetch:",
      autoFetch,
      "platform:",
      Platform.OS,
    );
    if (autoFetch) {
      if (Platform.OS === "web") {
        debugLog("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          debugLog(
            "[useAuth] Native cached user check:",
            cachedUser ? "present" : "absent",
          );
          if (cachedUser) {
            debugLog("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      debugLog("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    debugLog("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
    });
  }, [user, loading, isAuthenticated, error]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
    login,
    register,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount,
    resendVerification,
  };
}
