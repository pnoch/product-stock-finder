import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards the eBay Rust port against drift: the scraper file, its module
// registration, and the browser-first dispatch arm must all survive refactors
// together.
const TAURI_SRC = join(__dirname, "..", "src-tauri", "src");

describe("eBay Rust port", () => {
  it("ships ebay.rs with a browser-first JSON-LD scrape", () => {
    const file = join(TAURI_SRC, "scrapers", "ebay.rs");
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).toContain("ebay-us-");
    expect(src).toContain("fetch_with_browser(&url, None");
    expect(src).toContain("application/ld+json");
    expect(src).toContain("No eBay US price found");
  });

  it("registers the module and the browser-first dispatch arm", () => {
    const modRs = readFileSync(join(TAURI_SRC, "scrapers", "mod.rs"), "utf8");
    expect(modRs).toContain("pub mod ebay;");
    const libRs = readFileSync(join(TAURI_SRC, "lib.rs"), "utf8");
    expect(libRs).toContain('"ebay-us"');
    expect(libRs).toContain("scrapers::ebay::scrape(model, true)");
  });
});
