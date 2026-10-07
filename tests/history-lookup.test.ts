import { afterEach, describe, expect, it, vi } from "vitest";
import { createHistoryLookup } from "../server/notifications/build-events";
import type { PricePoint } from "../lib/types";

const { getPooledHistory } = vi.hoisted(() => ({
  getPooledHistory: vi.fn(async (): Promise<PricePoint[]> => []),
}));

vi.mock("../server/price-history", () => ({
  getPooledHistory,
  getHistory: vi.fn(async () => []),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("createHistoryLookup", () => {
  it("calls the underlying lookup once per distinct key", async () => {
    const lookup = createHistoryLookup();
    await lookup(["a", "b"], "M1");
    await lookup(["a", "b"], "M1");
    expect(getPooledHistory).toHaveBeenCalledTimes(1);

    await lookup(["a", "b"], "M2");
    expect(getPooledHistory).toHaveBeenCalledTimes(2);
  });
});
