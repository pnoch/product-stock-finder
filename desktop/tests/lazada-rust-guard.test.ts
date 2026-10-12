import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Guards the Lazada TH Rust port against drift: the scraper file, its module
// registration, and the dispatch arm must all survive refactors together.
const TAURI_SRC = join(__dirname, "..", "src-tauri", "src");

describe("Lazada Rust port", () => {
  it("ships lazada-th.rs with a plain-first scrape", () => {
    const file = join(TAURI_SRC, "scrapers", "lazada-th.rs");
    expect(existsSync(file)).toBe(true);
    const src = readFileSync(file, "utf8");
    expect(src).toContain("lazada-th-");
    expect(src).toContain("fetch_with_browser(&url, None");
    expect(src).toContain('"THB"');
    expect(src).toContain("No Lazada TH price found");
  });

  it("registers the module and the plain-first dispatch arm", () => {
    const modRs = readFileSync(join(TAURI_SRC, "scrapers", "mod.rs"), "utf8");
    expect(modRs).toContain("pub mod lazada_th;");
    const libRs = readFileSync(join(TAURI_SRC, "lib.rs"), "utf8");
    expect(libRs).toContain('"lazada-th"');
    expect(libRs).toContain("scrapers::lazada_th::scrape(model, false)");
  });
});
