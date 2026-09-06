import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop P3b-2 settings", () => {
  it("has an LLM provider section", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("llmProvider");
    expect(text).toContain("ollama-local");
  });

  it("has a scraper status section with re-enable", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Scraper Status");
    expect(text).toContain("updateProductListings");
  });

  it("has an about section without account deletion", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("beforeinstallprompt");
    expect(text).not.toContain("delete-account");
  });
});
