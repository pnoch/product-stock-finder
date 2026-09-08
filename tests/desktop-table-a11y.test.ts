import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop table accessibility", () => {
  it("exposes virtual row position", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("aria-rowcount");
    expect(text).toContain("aria-rowindex");
  });

  it("exposes sort, trend, and toggle states", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("aria-sort");
    expect(text).toContain("Trend ");
    expect(text).toContain("aria-pressed");
  });
});
