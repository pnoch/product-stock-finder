import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../src/lib/api-base", () => ({
  getApiBaseUrl: vi.fn(() => "https://api.test"),
  getAppId: vi.fn(() => "test-app"),
  getOAuthPortalUrl: vi.fn(() => ""),
}));

import {
  signInWithEmail,
  signUpWithEmail,
  changePassword,
  resetPassword,
  resendVerification,
  deleteAccount,
  getSessionToken,
  getUserInfo,
  subscribeAuth,
} from "../src/hooks/use-auth";
import { getApiBaseUrl } from "../src/lib/api-base";

if (typeof (globalThis as Record<string, unknown>).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

function okJson(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function errJson(status: number, payload: unknown) {
  return { ok: false, status, json: async () => payload };
}

describe("desktop auth functions", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getApiBaseUrl).mockReturnValue("https://api.test");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("login success stores token+user and notifies", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        sessionToken: "sess-1",
        user: {
          id: 7,
          openId: "email:1",
          name: "A",
          email: "a@b.com",
          loginMethod: "email",
          lastSignedIn: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    const listener = vi.fn();
    const unsub = subscribeAuth(listener);
    try {
      await signInWithEmail("a@b.com", "secret123");
    } finally {
      unsub();
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/login");
    expect(JSON.parse(String(init.body))).toEqual({ email: "a@b.com", password: "secret123" });
    expect(getSessionToken()).toBe("sess-1");
    expect(getUserInfo()).toMatchObject({ id: 7, email: "a@b.com", loginMethod: "email" });
    expect(listener).toHaveBeenCalled();
  });

  it("login 401 throws the server message", async () => {
    fetchMock.mockResolvedValue(errJson(401, { error: "Invalid credentials" }));
    await expect(signInWithEmail("a@b.com", "wrong")).rejects.toThrow("Invalid credentials");
    expect(getSessionToken()).toBeNull();
  });

  it("register sends the name", async () => {
    fetchMock.mockResolvedValue(
      okJson({
        sessionToken: "sess-2",
        user: {
          id: 8,
          openId: "email:2",
          name: "Bob",
          email: "b@b.com",
          loginMethod: "email",
          lastSignedIn: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    await signUpWithEmail("b@b.com", "secret123", "Bob");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/register");
    expect(JSON.parse(String(init.body))).toMatchObject({ email: "b@b.com", name: "Bob" });
    expect(getSessionToken()).toBe("sess-2");
  });

  it("changePassword sends the Bearer token", async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }));
    localStorage.setItem("desktop_session_token", "tok-123");
    await changePassword("old-pass", "new-pass-123");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/change-password");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-123");
    expect(JSON.parse(String(init.body))).toEqual({ currentPassword: "old-pass", newPassword: "new-pass-123" });
  });

  it("resetPassword posts token and newPassword", async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }));
    await resetPassword("reset-tok", "brand-new-1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/reset");
    expect(JSON.parse(String(init.body))).toEqual({ token: "reset-tok", newPassword: "brand-new-1" });
  });

  it("deleteAccount posts confirm DELETE with Bearer", async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }));
    localStorage.setItem("desktop_session_token", "tok-9");
    await deleteAccount();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/delete-account");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-9");
    expect(JSON.parse(String(init.body))).toEqual({ confirm: "DELETE" });
  });

  it("resendVerification hits the resend endpoint with Bearer", async () => {
    fetchMock.mockResolvedValue(okJson({ success: true }));
    localStorage.setItem("desktop_session_token", "tok-5");
    await resendVerification();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/auth/resend-verification");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-5");
  });

  it("throws before fetch when the server is not configured", async () => {
    vi.mocked(getApiBaseUrl).mockReturnValueOnce("");
    await expect(signInWithEmail("a@b.com", "secret123")).rejects.toThrow("Server not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
