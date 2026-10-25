import { describe, it, expect, vi, beforeEach } from "vitest";
import { runLaunchSequence } from "../src/lib/launch";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const storage = {
    getSettings: vi.fn().mockResolvedValue({ checkInterval: "hourly" }),
  };
  const deps = {
    storage,
    startPoller: vi.fn().mockResolvedValue(undefined),
    getApiBaseUrl: vi.fn().mockReturnValue("http://api"),
    loadFx: vi.fn().mockResolvedValue(undefined),
    maybeRefreshFx: vi.fn().mockResolvedValue(undefined),
    checkPricesOnce: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { storage, deps } as unknown as {
    storage: { getSettings: ReturnType<typeof vi.fn> };
    deps: Parameters<typeof runLaunchSequence>[0];
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runLaunchSequence", () => {
  it("runs a launch price check like the mobile app", async () => {
    // Mobile's app/_layout.tsx calls checkPriceDropsNow() on launch. Without the
    // desktop equivalent, the default "manual" interval meant alerts, restock
    // watches and the digest only ran after a manual refresh.
    const checkPricesOnce = vi.fn().mockResolvedValue(undefined);
    const { deps } = makeDeps({ checkPricesOnce });
    await runLaunchSequence(deps);
    expect(checkPricesOnce).toHaveBeenCalledTimes(1);
  });

  it("keeps launching when the launch price check fails", async () => {
    const checkPricesOnce = vi.fn().mockRejectedValue(new Error("offline"));
    const { deps } = makeDeps({ checkPricesOnce });
    await expect(runLaunchSequence(deps)).resolves.toBeUndefined();
    expect(deps.loadFx as ReturnType<typeof vi.fn>).toHaveBeenCalled();
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
        getSettings: vi.fn().mockRejectedValue(new Error("nope")),
      },
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
