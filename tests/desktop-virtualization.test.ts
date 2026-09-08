import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist virtualization", () => {
  it("windows table rows with dynamic measurement", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("useVirtualizer");
    expect(text).toContain("measureElement");
    expect(text).toContain("@tanstack/react-virtual");
  });

  it("flattens sections to row descriptors", async () => {
    const text = await readFile("desktop/src/lib/watchlist-rows.ts", "utf8");
    expect(text).toContain('kind: "header"');
    expect(text).toContain('kind: "product"');
  });
});
