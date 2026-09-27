import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useWatchlist } from "../src/hooks/use-storage";

const mockStorage = vi.hoisted(() => ({ getWatchlist: vi.fn() }));

vi.mock("../src/storage", () => ({ storage: mockStorage }));
vi.mock("../src/background", () => ({
  onListingUpdated: vi.fn(async () => () => {}),
}));

describe("useWatchlist refresh state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("spins on the first load", async () => {
    let resolveLoad: (v: unknown) => void = () => {};
    mockStorage.getWatchlist.mockImplementationOnce(
      () => new Promise((r) => (resolveLoad = r)),
    );
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.loading).toBe(true);
    await act(async () => {
      resolveLoad([{ id: "p1" }]);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products).toHaveLength(1);
  });

  it("does not blank the page on a later refresh", async () => {
    // The Rust poller emits listing-updated once per scraped listing; resetting
    // `loading` on every refresh replaced the page with a spinner N times per
    // sweep (resetting scroll/selection). Later refreshes must raise
    // `refreshing` instead.
    mockStorage.getWatchlist.mockResolvedValueOnce([{ id: "p1" }]);
    const { result } = renderHook(() => useWatchlist());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let resolveRefresh: (v: unknown) => void = () => {};
    mockStorage.getWatchlist.mockImplementationOnce(
      () => new Promise((r) => (resolveRefresh = r)),
    );
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    await act(async () => {
      resolveRefresh([{ id: "p1" }, { id: "p2" }]);
      await pending;
    });
    expect(result.current.refreshing).toBe(false);
    expect(result.current.products).toHaveLength(2);
  });
});
