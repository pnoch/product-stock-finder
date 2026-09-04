import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { getSessionToken, useAuth } from "../src/hooks/use-auth";

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
});
