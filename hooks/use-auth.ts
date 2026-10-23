import { log } from "@shared/log";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import {
  changePassword as changePasswordRequest,
  deleteAccount as deleteAccountRequest,
  fetchCurrentUser,
  forgotPassword as forgotPasswordRequest,
  loginWithEmail,
  registerWithEmail,
  resendVerification as resendVerificationRequest,
  resetPassword as resetPasswordRequest,
} from "./auth-api";

const debugLog = (...args: unknown[]) => {
  if (!__DEV__) return;
  log.debug(...args);
};

type UseAuthOptions = {
  autoFetch?: boolean;
};

// Module-level shared auth state. Without this every `useAuth()` call had its
// own copy, so signing in from Settings never flipped the root layout's
// `isAuthenticated` (sync/backfill/push registration never started) and signing
// out left the layout thinking it was still signed in.
type AuthSnapshot = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
};
let sharedSnapshot: AuthSnapshot = { user: null, loading: true, error: null };
const authSubscribers = new Set<() => void>();

function setShared(patch: Partial<AuthSnapshot>): void {
  sharedSnapshot = { ...sharedSnapshot, ...patch };
  for (const fn of authSubscribers) fn();
}

// Publishes an auth change made outside `useAuth` (e.g. the native OAuth
// callback writing the session token directly). Without this the root layout's
// `isAuthenticated` stayed false after a native sign-in, so sync, backfill, and
// push registration never started until the app restarted.
export function publishAuthUser(user: Auth.User | null): void {
  setShared({ user, loading: false, error: null });
}

function subscribeAuth(onStoreChange: () => void): () => void {
  authSubscribers.add(onStoreChange);
  return () => {
    authSubscribers.delete(onStoreChange);
  };
}

function getAuthSnapshot(): AuthSnapshot {
  return sharedSnapshot;
}

// Auth is consumed by ~13 call sites, most with the default `autoFetch`. Without
// this every mount fired its own `/api/auth/me`, so a cold start issued a burst
// of identical requests. Share the in-flight promise and debounce repeat calls.
let inFlightFetch: Promise<void> | null = null;
let lastFetchAt = 0;
const FETCH_TTL_MS = 2_000;

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const snapshot = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthSnapshot,
  );
  const { user, loading, error } = snapshot;

  const setUser = useCallback((next: Auth.User | null) => {
    setShared({ user: next });
  }, []);
  const setLoading = useCallback((next: boolean) => {
    setShared({ loading: next });
  }, []);
  const setError = useCallback((next: Error | null) => {
    setShared({ error: next });
  }, []);

  const fetchUser = useCallback(async () => {
    if (inFlightFetch) return inFlightFetch;
    if (Date.now() - lastFetchAt < FETCH_TTL_MS) return;
    inFlightFetch = (async () => {
      debugLog("[useAuth] fetchUser called");
      await fetchCurrentUser(setUser, setLoading, setError);
    })().finally(() => {
      inFlightFetch = null;
      lastFetchAt = Date.now();
    });
    return inFlightFetch;
  }, [setError, setLoading, setUser]);

  const logout = useCallback(async () => {
    try {
      // Retract the server-side push binding first: otherwise the account's
      // alerts keep being pushed to this now-signed-out device.
      const { unregisterPushToken } = await import("@/lib/push-token");
      await unregisterPushToken();
    } catch (err) {
      log.error("[Auth] Push unregister failed:", err);
    }
    try {
      await Api.logout();
    } catch (err) {
      log.error("[Auth] Logout API call failed:", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      // Clear the previous account's synced data + sync cursor so the next
      // account on this device does not inherit them. Device-local preferences
      // (onboarding, theme, currency, notification toggles) are preserved.
      try {
        const { clearAccountData } = await import("@/lib/storage");
        await clearAccountData();
      } catch (err) {
        log.error("[Auth] Local data clear on logout failed:", err);
      }
      setUser(null);
      setError(null);
    }
  }, [setError, setUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await loginWithEmail(email, password, setUser);
    },
    [setUser],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      await registerWithEmail(email, password, name, setUser);
    },
    [setUser],
  );

  const forgotPassword = useCallback(
    async (email: string) => forgotPasswordRequest(email),
    [],
  );

  const resetPassword = useCallback(
    async (token: string, newPassword: string) =>
      resetPasswordRequest(token, newPassword),
    [],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) =>
      changePasswordRequest(currentPassword, newPassword),
    [],
  );

  const deleteAccount = useCallback(
    async (confirm: string = "DELETE") =>
      deleteAccountRequest(confirm, setUser),
    [setUser],
  );

  const resendVerification = useCallback(
    async () => resendVerificationRequest(),
    [],
  );

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
  }, [autoFetch, fetchUser, setLoading, setUser]);

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
