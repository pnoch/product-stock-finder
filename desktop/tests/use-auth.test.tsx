import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockUnregisterMutate = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({
    notifications: { unregisterPushToken: { mutate: mockUnregisterMutate } },
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import { getSessionToken, setSessionToken, setUserInfo, getUserInfo, useAuth } from "../src/hooks/use-auth";
import { PENDING_UNREGISTER_KEY } from "../src/lib/web-push";

const mockedInvoke = vi.mocked(invoke);

describe("desktop auth malformed user", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears the session token when the user payload is malformed", async () => {
    mockedInvoke.mockResolvedValue({ sessionToken: "token-1", user: "not-json" });
    const { result } = renderHook(() => useAuth());
    let ok = false;
    await act(async () => {
      ok = await result.current.login("https://example.com/login");
    });
    expect(ok).toBe(false);
    expect(getSessionToken()).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("unregisters push on logout without blocking", async () => {
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    setSessionToken("token-1");
    setUserInfo({
      id: 1,
      openId: "o1",
      name: "Test",
      email: "t@example.com",
      loginMethod: "email",
      lastSignedIn: new Date().toISOString(),
    });
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.logout();
    });
    expect(mockUnregisterMutate).toHaveBeenCalledTimes(1);
    expect(mockUnregisterMutate.mock.calls[0][0]).toBeUndefined();
    expect(getSessionToken()).toBeNull();
    expect(getUserInfo()).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("still completes logout when unregister rejects", async () => {
    mockUnregisterMutate.mockRejectedValue(new Error("401"));
    setSessionToken("token-1");
    setUserInfo({
      id: 1,
      openId: "o1",
      name: "Test",
      email: "t@example.com",
      loginMethod: "email",
      lastSignedIn: new Date().toISOString(),
    });
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.logout();
    });
    expect(mockUnregisterMutate).toHaveBeenCalledTimes(1);
    expect(getSessionToken()).toBeNull();
    expect(getUserInfo()).toBeNull();
  });

  it("flags unregister for retry when logout unregister fails", async () => {
    mockUnregisterMutate.mockRejectedValue(new Error("offline"));
    setSessionToken("token-1");
    setUserInfo({
      id: 1,
      openId: "o1",
      name: "Test",
      email: "t@example.com",
      loginMethod: "email",
      lastSignedIn: new Date().toISOString(),
    });
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.logout();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(localStorage.getItem(PENDING_UNREGISTER_KEY)).toBe("1");
    expect(getSessionToken()).toBeNull();
  });

  it("leaves no retry flag when logout unregister succeeds", async () => {
    mockUnregisterMutate.mockResolvedValue({ accepted: true });
    setSessionToken("token-1");
    setUserInfo({
      id: 1,
      openId: "o1",
      name: "Test",
      email: "t@example.com",
      loginMethod: "email",
      lastSignedIn: new Date().toISOString(),
    });
    const { result } = renderHook(() => useAuth());
    act(() => {
      result.current.logout();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(localStorage.getItem(PENDING_UNREGISTER_KEY)).toBeNull();
  });
});
