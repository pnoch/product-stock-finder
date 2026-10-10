import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("server drops endpoint", () => {
  it("prices router exposes topDrops query", () => {
    const src = readFileSync(join(__dirname, "..", "server", "routers", "prices.ts"), "utf8");
    expect(src).toContain("topDrops");
  });

  it("server price-leaderboard module exists and exports topDrops", () => {
    const src = readFileSync(join(__dirname, "..", "server", "price-leaderboard.ts"), "utf8");
    expect(src).toContain("export async function topDrops");
  });
});