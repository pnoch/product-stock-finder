// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { ReactNode } from "react";

vi.mock("@/constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

import { useConnection } from "../hooks/use-connection";

const { addEventListenerMock, emitAppState } = vi.hoisted(() => {
  const handlers = new Set<(state: string) => void>();
  return {
    addEventListenerMock: vi.fn(
      (_event: string, handler: (state: string) => void) => {
        handlers.add(handler);
        return {
          remove: vi.fn(() => {
            handlers.delete(handler);
          }),
        };
      },
    ),
    emitAppState: (state: string) => {
      handlers.forEach((h) => h(state));
    },
  };
});

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  AppState: { addEventListener: addEventListenerMock },
}));

vi.mock("../lib/health", () => ({
  checkHealth: vi.fn(),
}));

vi.mock("../lib/server-prices", () => ({
  fetchServerPrice: vi.fn(),
}));

vi.mock("../hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({ isAuthenticated: true })),
}));

import { checkHealth } from "../lib/health";
import { useAuth } from "../hooks/use-auth";
import type * as Auth from "../lib/_core/auth";

function makeAuth(isAuthenticated: boolean) {
  return {
    user: isAuthenticated ? ({ id: "u1" } as unknown as Auth.User) : null,
    loading: false,
    error: null,
    isAuthenticated,
    refresh: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    login: vi.fn(async () => {}),
    register: vi.fn(async () => {}),
    forgotPassword: vi.fn(async () => {}),
    resetPassword: vi.fn(async () => {}),
    changePassword: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
    resendVerification: vi.fn(async () => {}),
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe("useConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkHealth).mockResolvedValue(true);
    vi.mocked(useAuth).mockReturnValue(makeAuth(true));
  });

  it("reports connected when the backend is reachable and signed in", async () => {
    const { result } = renderHook(() => useConnection(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.reachable).toBe(true));
    expect(result.current.status).toBe("connected");
  });

  it("reports signed-out when reachable but not authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth(false));
    const { result } = renderHook(() => useConnection(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.reachable).toBe(true));
    expect(result.current.status).toBe("signed-out");
  });

  it("reports offline when the backend is unreachable", async () => {
    vi.mocked(checkHealth).mockResolvedValue(false);
    const { result } = renderHook(() => useConnection(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.reachable).toBe(false));
    expect(result.current.status).toBe("offline");
  });

  it("refetches when the app returns to the active state", async () => {
    const { result } = renderHook(() => useConnection(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.reachable).toBe(true));
    expect(checkHealth).toHaveBeenCalledTimes(1);

    vi.mocked(checkHealth).mockResolvedValue(false);
    emitAppState("active");

    await waitFor(() => expect(result.current.reachable).toBe(false));
    expect(checkHealth).toHaveBeenCalledTimes(2);
  });
});
