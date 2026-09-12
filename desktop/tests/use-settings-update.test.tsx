import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { AppSettings } from "../../lib/types";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const persisted: { current: AppSettings } = {
  current: {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
  } as AppSettings,
};

const mockStorage = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

import { useSettings } from "../src/hooks/use-storage";

beforeEach(() => {
  vi.clearAllMocks();
  persisted.current = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    healthAlerts: true,
  } as AppSettings;
  mockStorage.getSettings.mockImplementation(async () => {
    await delay(10);
    return { ...persisted.current };
  });
  mockStorage.saveSettings.mockImplementation(async (s: AppSettings) => {
    await delay(10);
    persisted.current = { ...s };
  });
});

describe("useSettings update", () => {
  it("persists rapid double-toggle without lost update", async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => expect(result.current.settings).not.toBeNull());

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.update({ theme: "dark" });
      p2 = result.current.update({ displayCurrency: "EUR" });
    });

    // Optimistic UI applies synchronously for both patches
    expect(result.current.settings).toMatchObject({
      theme: "dark",
      displayCurrency: "EUR",
    });

    await act(async () => {
      await Promise.all([p1, p2]);
    });

    expect(persisted.current).toMatchObject({
      theme: "dark",
      displayCurrency: "EUR",
    });
    // Serialized writes: one save per update, single final state
    expect(mockStorage.saveSettings).toHaveBeenCalledTimes(2);
  });

  it("logs save failures instead of rejecting unhandled", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mockStorage.saveSettings.mockRejectedValueOnce(new Error("disk full"));
      const { result } = renderHook(() => useSettings());
      await waitFor(() => expect(result.current.settings).not.toBeNull());

      let p!: Promise<void>;
      act(() => {
        p = result.current.update({ theme: "dark" });
      });
      await act(async () => {
        await p.catch(() => {});
      });

      expect(errSpy).toHaveBeenCalledWith(
        "[settings] save failed",
        expect.any(Error),
      );

      // Chain self-heals: a later write still goes through
      mockStorage.saveSettings.mockImplementation(async (s: AppSettings) => {
        persisted.current = { ...s };
      });
      await act(async () => {
        await result.current.update({ displayCurrency: "EUR" });
      });
      expect(persisted.current.displayCurrency).toBe("EUR");
    } finally {
      errSpy.mockRestore();
    }
  });
});
