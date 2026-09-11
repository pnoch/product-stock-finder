import { describe, it, expect, vi, beforeEach } from "vitest";
import { runLaunchSequence } from "../src/lib/launch";

const SEED_IDS = [
  "mikrotik-crs804-4ddq-hrm",
  "mikrotik-crs326-24s",
  "nvidia-rtx-4090",
  "apple-macbook-pro-m4-max",
  "raspberry-pi-5-8gb",
  "apple-airpods-max-2",
  "valve-steam-deck-oled",
] as const;

function makeCatalog() {
  return SEED_IDS.map((id) => ({
    id,
    name: `Product ${id}`,
    modelNumber: id,
    brand: "Test",
    category: "Test",
    description: "desc",
  }));
}

function makeSampleListings() {
  const listings: Record<string, Array<{ distributorId: string }>> = {};
  for (const id of SEED_IDS) {
    listings[id] = [{ distributorId: `dist-${id}` }];
  }
  return listings as never;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const storage = {
    getWatchlist: vi.fn().mockResolvedValue([]),
    addToWatchlist: vi.fn().mockResolvedValue(undefined),
    updateProductListings: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({ checkInterval: "hourly" }),
  };
  const deps = {
    storage,
    catalog: makeCatalog(),
    sampleListings: makeSampleListings(),
    freshen: vi.fn((listings: unknown) => listings),
    startPoller: vi.fn().mockResolvedValue(undefined),
    getApiBaseUrl: vi.fn().mockReturnValue("http://api"),
    loadFx: vi.fn().mockResolvedValue(undefined),
    maybeRefreshFx: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { storage, deps } as unknown as {
    storage: {
      getWatchlist: ReturnType<typeof vi.fn>;
      addToWatchlist: ReturnType<typeof vi.fn>;
      updateProductListings: ReturnType<typeof vi.fn>;
      getSettings: ReturnType<typeof vi.fn>;
    };
    deps: Parameters<typeof runLaunchSequence>[0];
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runLaunchSequence", () => {
  it("seeds 7 products with freshened listings on empty watchlist", async () => {
    const { storage, deps } = makeDeps();
    await runLaunchSequence(deps);
    expect(storage.addToWatchlist).toHaveBeenCalledTimes(7);
    const ids = storage.addToWatchlist.mock.calls.map(
      (c) => (c[0] as { id: string }).id,
    );
    expect([...ids].sort()).toEqual([...SEED_IDS].sort());
    expect(deps.freshen as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(7);
    for (const call of storage.addToWatchlist.mock.calls) {
      const product = call[0] as { isWatched: boolean; addedAt: string; listings: unknown };
      expect(product.isWatched).toBe(true);
      expect(typeof product.addedAt).toBe("string");
    }
  });

  it("skips present products and backfills MikroTik listings when empty", async () => {
    const catalog = makeCatalog();
    const sampleListings = makeSampleListings();
    const storage = {
      getWatchlist: vi.fn().mockResolvedValue([
        { id: "mikrotik-crs804-4ddq-hrm", listings: [] },
        { id: "nvidia-rtx-4090", listings: [{ distributorId: "x" }] },
      ]),
      addToWatchlist: vi.fn().mockResolvedValue(undefined),
      updateProductListings: vi.fn().mockResolvedValue(undefined),
      getSettings: vi.fn().mockResolvedValue({ checkInterval: "manual" }),
    };
    const freshen = vi.fn((listings: unknown) => listings);
    await runLaunchSequence({
      storage,
      catalog,
      sampleListings,
      freshen,
      startPoller: vi.fn(),
      getApiBaseUrl: vi.fn().mockReturnValue(""),
      loadFx: vi.fn().mockResolvedValue(undefined),
      maybeRefreshFx: vi.fn().mockResolvedValue(undefined),
    } as unknown as Parameters<typeof runLaunchSequence>[0]);
    const addedIds = storage.addToWatchlist.mock.calls.map(
      (c) => (c[0] as { id: string }).id,
    );
    expect(addedIds).not.toContain("mikrotik-crs804-4ddq-hrm");
    expect(addedIds).not.toContain("nvidia-rtx-4090");
    expect(addedIds).toHaveLength(5);
    expect(storage.updateProductListings).toHaveBeenCalledTimes(1);
    expect(storage.updateProductListings).toHaveBeenCalledWith(
      "mikrotik-crs804-4ddq-hrm",
      expect.anything(),
    );
  });

  it("starts poller with 60 minutes for hourly, skips on manual", async () => {
    const hourly = makeDeps();
    await runLaunchSequence(hourly.deps);
    expect(hourly.deps.startPoller as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      60,
      "http://api",
    );

    const manual = makeDeps({
      storage: {
        getWatchlist: vi.fn().mockResolvedValue([{ id: "x" }]),
        addToWatchlist: vi.fn(),
        updateProductListings: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ checkInterval: "manual" }),
      },
    });
    await runLaunchSequence(manual.deps);
    expect(manual.deps.startPoller as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it("attempts FX load and refresh", async () => {
    const { deps } = makeDeps();
    await runLaunchSequence(deps);
    expect(deps.loadFx as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(deps.maybeRefreshFx as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it("never throws when deps fail", async () => {
    const { deps } = makeDeps({
      storage: {
        getWatchlist: vi.fn().mockRejectedValue(new Error("db down")),
        addToWatchlist: vi.fn().mockRejectedValue(new Error("nope")),
        updateProductListings: vi.fn().mockRejectedValue(new Error("nope")),
        getSettings: vi.fn().mockRejectedValue(new Error("nope")),
      },
      freshen: vi.fn(() => {
        throw new Error("freshen boom");
      }),
      startPoller: vi.fn().mockRejectedValue(new Error("poller boom")),
      getApiBaseUrl: vi.fn(() => {
        throw new Error("url boom");
      }),
      loadFx: vi.fn().mockRejectedValue(new Error("fx boom")),
      maybeRefreshFx: vi.fn().mockRejectedValue(new Error("fx boom")),
    });
    await expect(runLaunchSequence(deps)).resolves.toBeUndefined();
  });
});
