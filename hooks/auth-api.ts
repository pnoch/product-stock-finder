import { log } from "@shared/log";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/constants/oauth";
import { Platform } from "react-native";

type ApiUser = NonNullable<Awaited<ReturnType<typeof Api.getMe>>> & {
  emailVerified?: boolean;
};

type SetUser = (user: Auth.User | null) => void;

// Every auth request must carry the device id: the server binds the session to
// it, un-revokes the presenting device on login, and enforces revocation on the
// account-mutation routes. Without it a revoked device could sign back in (and
// mutate the account) because the server sees no device.
export async function deviceHeader(): Promise<Record<string, string>> {
  try {
    const { getDeviceId } = await import("@/lib/device-id");
    const id = await getDeviceId();
    return id ? { "x-device-id": id } : {};
  } catch {
    return {};
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await deviceHeader()),
  };
  if (Platform.OS !== "web") {
    const token = await Auth.getSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function toUserInfo(
  apiUser: ApiUser,
  loginMethod: string,
): Auth.User {
  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    loginMethod,
    lastSignedIn: new Date(),
    emailVerified: apiUser.emailVerified ?? false,
  };
}

export async function fetchCurrentUser(
  setUser: SetUser,
  setLoading: (loading: boolean) => void,
  setError: (error: Error | null) => void,
): Promise<void> {
  try {
    setLoading(true);
    setError(null);

    if (Platform.OS === "web") {
      const apiUser: ApiUser | null = await Api.getMe();
      if (apiUser) {
        const userInfo = toUserInfo(apiUser, apiUser.loginMethod ?? "email");
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      } else {
        setUser(null);
        await Auth.clearUserInfo();
      }
      return;
    }

    const sessionToken = await Auth.getSessionToken();
    if (!sessionToken) {
      setUser(null);
      return;
    }
    const cachedUser = await Auth.getUserInfo();
    setUser(cachedUser ?? null);
  } catch (err) {
    const error =
      err instanceof Error ? err : new Error("Failed to fetch user");
    log.error("[useAuth] fetchUser error:", error);
    setError(error);
    setUser(null);
  } finally {
    setLoading(false);
  }
}

async function emailAuthRequest(
  path: "login" | "register",
  body: Record<string, unknown>,
  setUser: SetUser,
  failureMessage: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/auth/${path}`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || failureMessage);
  }
  const data = await res.json();
  if (data.sessionToken && Platform.OS !== "web") {
    await Auth.setSessionToken(data.sessionToken);
  }
  if (data.user) {
    const userInfo = toUserInfo(data.user, "email");
    await Auth.setUserInfo(userInfo);
    setUser(userInfo);
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
  setUser: SetUser,
): Promise<void> {
  try {
    await emailAuthRequest("login", { email, password }, setUser, "Login failed");
  } catch (err) {
    throw err instanceof Error ? err : new Error("Login failed");
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  name: string | undefined,
  setUser: SetUser,
): Promise<void> {
  try {
    await emailAuthRequest(
      "register",
      { email, password, name },
      setUser,
      "Registration failed",
    );
  } catch (err) {
    throw err instanceof Error ? err : new Error("Registration failed");
  }
}

export async function forgotPassword(email: string): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("This build isn't connected to a server.");
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
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<unknown> {
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
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("This build isn't connected to a server.");
  const res = await fetch(`${baseUrl}/api/auth/change-password`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Change password failed");
  }
  const data = await res.json().catch(() => ({}));
  // The server re-mints the caller's session under the new credential epoch;
  // without persisting it the current device would be signed out too.
  if (data?.sessionToken && Platform.OS !== "web") {
    await Auth.setSessionToken(data.sessionToken);
  }
  return data;
}

export async function deleteAccount(
  confirm: string,
  setUser: SetUser,
): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("This build isn't connected to a server.");
  const res = await fetch(`${baseUrl}/api/auth/delete-account`, {
    method: "POST",
    headers: await authHeaders(),
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
}

export async function resendVerification(): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("This build isn't connected to a server.");
  const res = await fetch(`${baseUrl}/api/auth/resend-verification`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({}),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to resend verification email");
  }
  return res.json();
}
