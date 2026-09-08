import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop refresh hardening", () => {
  it("times out slow price queries", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("QUERY_TIMEOUT_MS");
    expect(text).toContain("onProgress");
  });

  it("shows refresh progress on the button", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("refreshProgress");
    expect(text).toContain("Refreshing");
  });
});
