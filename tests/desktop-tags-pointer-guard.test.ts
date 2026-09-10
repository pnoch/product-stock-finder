import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("search modal tags pointer", () => {
  it("points tag creation at the watchlist, not settings", async () => {
    const text = await readFile("desktop/src/components/SearchModal.tsx", "utf8");
    expect(text).toContain("Create tags in Watchlist");
    expect(text).not.toContain("Create tags in Settings");
    expect(text).toContain("/watchlist");
  });
});
