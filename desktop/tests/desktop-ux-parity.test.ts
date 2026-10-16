import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("desktop UX parity", () => {
  it("rates header doesn't claim there's no data while showing built-in rates", () => {
    const src = read("src/pages/Rates.tsx");
    expect(src).toContain("Using built-in rates");
    expect(src).not.toContain("No data yet");
  });

  it("stats notes how many more products are at an all-time low", () => {
    expect(read("src/pages/Stats.tsx")).toContain("more at all-time low");
  });

  it("health detail shares the status color rule", () => {
    expect(read("src/pages/HealthDetail.tsx")).toContain("healthStatusColor");
  });
});
