// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DistributorHealth } from "../lib/scrapers/health";

const state = vi.hoisted(() => ({
  health: [] as DistributorHealth[],
  testResults: [] as DistributorHealth[],
  testDistributorResult: null as DistributorHealth | null,
  markedUnlocked: [] as string[],
  progress: [] as number[],
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {},
}));

vi.mock("@/lib/scrapers/health", () => ({
  createHealthService: () => ({
    getDistributorHealth: async () => state.health,
    getHealthHistory: async () => ({}),
    testAllDistributors: async (onProgress?: (c: number, t: number) => void) => {
      onProgress?.(1, 2);
      onProgress?.(2, 2);
      return state.testResults;
    },
    testDistributor: async () => state.testDistributorResult,
  }),
  computeHealthStats: () => ({
    d1: { uptimePct: 100, trend: "flat", sparkline: [1, 1] },
  }),
}));

vi.mock("@/lib/scrapers/session-store", () => ({
  markUnlocked: async (id: string) => {
    state.markedUnlocked.push(id);
  },
}));

vi.mock("@/lib/alert", () => ({ showAlert: vi.fn() }));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({}) }));
vi.mock("@/lib/health-status", () => ({ healthStatusColor: () => "#000" }));

import { useHealthScreen } from "../hooks/use-health-screen";

function health(
  distributorId: string,
  status: "working" | "blocked" | "error",
): DistributorHealth {
  return {
    distributorId,
    status,
    lastChecked: "2026-02-01T00:00:00.000Z",
  };
}

describe("useHealthScreen", () => {
  beforeEach(() => {
    state.health = [health("d1", "working"), health("d2", "blocked")];
    state.testResults = [health("d1", "working"), health("d2", "working")];
    state.testDistributorResult = health("d2", "working");
    state.markedUnlocked = [];
    state.progress = [];
  });

  it("loads health and stats", async () => {
    const { result } = renderHook(() => useHealthScreen());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.health).toHaveLength(2);
    expect(result.current.stats.d1?.uptimePct).toBe(100);
  });

  it("derives counts and filters", async () => {
    const { result } = renderHook(() => useHealthScreen());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.counts).toEqual({ working: 1, blocked: 1, error: 0 });

    act(() => result.current.setFilter("blocked"));
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0]!.distributorId).toBe("d2");
  });

  it("runs a full test and reports progress", async () => {
    const { result } = renderHook(() => useHealthScreen());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.runTest();
    });
    expect(result.current.health).toHaveLength(2);
    expect(result.current.testing).toBe(false);
    expect(result.current.progress).toBe(100);
  });

  it("marks the distributor unlocked and re-probes after assist", async () => {
    const { result } = renderHook(() => useHealthScreen());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setAssistParserId("d2"));
    await act(async () => {
      await result.current.handleAssistDone();
    });
    expect(state.markedUnlocked).toEqual(["d2"]);
    expect(result.current.health.find((h) => h.distributorId === "d2")?.status).toBe(
      "working",
    );
  });
});
