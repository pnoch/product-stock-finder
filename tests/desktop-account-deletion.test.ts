import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop account deletion", () => {
  it("offers server account deletion via helper", async () => {
    const text = await readFile(
      "desktop/src/components/settings/danger-zone-section.tsx",
      "utf8",
    );
    expect(text).toContain("Delete Account & Data");
    expect(text).toContain("deleteAccount(");
  });

  it("wipes local data only after server confirms", async () => {
    const text = await readFile(
      "desktop/src/components/settings/danger-zone-section.tsx",
      "utf8",
    );
    const deleteIdx = text.indexOf("deleteAccount(");
    const wipeIdx = text.indexOf("clearAllData", deleteIdx);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(wipeIdx).toBeGreaterThan(deleteIdx);
  });
});
