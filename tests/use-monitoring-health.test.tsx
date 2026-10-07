// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HOUR = 60 * 60 * 1000;

const state = vi.hoisted(() => ({
  platform: "ios" as string,
  checkInterval: "hourly" as string,
  enforce: false,
  isPro: false,
  registered: false,
  lastRunAt: null as number | null,
}));

const { focusHandlers, emitFocus } = vi.hoisted(() => {
  const handlers = new Set<() => void>();
  return {
    focusHandlers: handlers,
    emitFocus: () => {
      handlers.forEach((h) => h());
    },
  };
});

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.platform;
    },
  },
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock("expo-task-manager", () => ({
  isTaskRegisteredAsync: vi.fn(async () => state.registered),
}));

vi.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => {
    focusHandlers.add(cb);
    return () => {
      focusHandlers.delete(cb);
    };
  },
}));

vi.mock("@/lib/background-tasks/tasks", () => ({
  PRICE_CHECK_TASK: "price-drop-check",
}));

vi.mock("@/lib/storage", () => ({
  getSettings: vi.fn(async () => ({ checkInterval: state.checkInterval })),
  getLastBackgroundRun: vi.fn(async () => state.lastRunAt),
}));

vi.mock("@/lib/entitlements", () => ({
  getEntitlementState: vi.fn(async () => ({
    tier: state.isPro ? "pro" : "free",
    isPro: state.isPro,
  })),
}));

vi.mock("@/lib/pro-features", () => ({
  shouldEnforceFreeLimits: vi.fn(() => state.enforce),
}));

import { useMonitoringHealth } from "../hooks/use-monitoring-health";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  focusHandlers.clear();
  state.platform = "ios";
  state.checkInterval = "hourly";
  state.enforce = false;
  state.isPro = false;
  state.registered = true;
  state.lastRunAt = Date.now();
});

describe("useMonitoringHealth", () => {
  it("is off on web", async () => {
    state.platform = "web";
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("off"));
  });

  it("is ok when enabled, registered and freshly run", async () => {
    state.lastRunAt = Date.now() - 1000;
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("ok"));
  });

  it("is stopped when enabled but unregistered", async () => {
    state.registered = false;
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("stopped"));
  });

  it("is stale when the last run is older than 2x the interval", async () => {
    state.lastRunAt = Date.now() - 3 * HOUR;
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("stale"));
  });

  it("is off when the interval is manual", async () => {
    state.checkInterval = "manual";
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("off"));
  });

  it("re-assesses when the screen regains focus", async () => {
    const { result } = renderHook(() => useMonitoringHealth());
    await waitFor(() => expect(result.current.health.status).toBe("ok"));
    // The task stopped while Home was off-screen; returning to it must not
    // keep showing the stale "ok".
    state.registered = false;
    emitFocus();
    await waitFor(() => expect(result.current.health.status).toBe("stopped"));
  });
});
