import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop stats parity 2", () => {
  it("has basket alert threshold UI", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("basketAlertThreshold");
    expect(text).toContain("Set alert");
  });

  it("makes the drop calendar keyboard accessible", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain('role="grid"');
    expect(text).toContain('role="gridcell"');
  });

  it("formats sparkline values and offers share choice", async () => {
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const rates = await readFile("desktop/src/pages/Rates.tsx", "utf8");
    const stats = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(detail).toContain("formatPrice(first");
    expect(rates).toContain("formatPrice(first");
    expect(stats).toContain("Copy text");
    expect(stats).toContain("Save image");
  });
});
