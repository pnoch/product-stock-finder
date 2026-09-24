import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("search modal tags pointer", () => {
  // QA round 167: the picker now creates tags inline (like mobile's
  // TagPickerSheet) instead of pointing at the watchlist/settings.
  it("creates tags inline rather than pointing elsewhere", async () => {
    const text = await readFile("desktop/src/components/SearchModal.tsx", "utf8");
    expect(text).toContain("Create tag");
    expect(text).toContain("New tag name");
    expect(text).not.toContain("Create tags in Settings");
    expect(text).not.toContain("Create tags in Watchlist");
  });
});
