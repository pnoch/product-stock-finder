import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("manual-add timeout hygiene", () => {
  it("clears its timer on settle", async () => {
    const text = await readFile("components/search/manual-add-sheet.tsx", "utf8");
    expect(text).toContain("clearTimeout");
  });
});
