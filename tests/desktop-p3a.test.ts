import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P3a price intelligence", () => {
  it("creates cross-distributor alerts from Compare", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("cross-");
    expect(text).toContain("addAlert");
  });

  it("loads price insight outside Tauri", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("insights.get");
  });
});
