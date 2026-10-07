import { describe, expect, it, vi } from "vitest";
import { toggleAnyWatchRecord } from "../lib/any-watch";

const listings = [
  { distributorId: "d1", stockStatus: "out_of_stock" },
] as never;

describe("toggleAnyWatchRecord", () => {
  it("creates an any-watch when none exists", async () => {
    const addStockWatch = vi.fn<(watch: unknown) => Promise<void>>(
      async () => {},
    );
    const removeAnyWatch = vi.fn(async () => {});
    const action = await toggleAnyWatchRecord({
      isWatching: false,
      productId: "p1",
      productName: "CRS804",
      listings,
      addStockWatch,
      removeAnyWatch,
    });
    expect(action).toBe("created");
    expect(addStockWatch).toHaveBeenCalledTimes(1);
    expect(removeAnyWatch).not.toHaveBeenCalled();
    const watch = addStockWatch.mock.calls[0]![0] as {
      distributorId: string;
      scope: string;
    };
    expect(watch.distributorId).toBe("*");
    expect(watch.scope).toBe("any");
  });

  it("removes the any-watch when one exists", async () => {
    const addStockWatch = vi.fn(async () => {});
    const removeAnyWatch = vi.fn(async () => {});
    const action = await toggleAnyWatchRecord({
      isWatching: true,
      productId: "p1",
      productName: "CRS804",
      listings,
      addStockWatch,
      removeAnyWatch,
    });
    expect(action).toBe("removed");
    expect(removeAnyWatch).toHaveBeenCalledTimes(1);
    expect(addStockWatch).not.toHaveBeenCalled();
  });
});
