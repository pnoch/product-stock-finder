import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop export shortcut", () => {
  it("handles export failure with feedback", async () => {
    const text = await readFile("desktop/src/App.tsx", "utf8");
    expect(text).toContain("exportWatchlistAsJson().catch");
    expect(text).toContain("Export failed");
  });
});
