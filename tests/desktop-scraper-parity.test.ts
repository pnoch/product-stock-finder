import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Guards the class of bug where the desktop (Rust) scrapers drift from the
// mobile (TS) ones: wrong search URL or wrong price selector means desktop
// silently reports "no price found" for a distributor that mobile handles.

async function mobileParsers(): Promise<Map<string, { url: string; selector: string }>> {
  const dir = "lib/scrapers";
  const out = new Map<string, { url: string; selector: string }>();
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".ts")) continue;
    const name = file.slice(0, -3);
    const src = await readFile(path.join(dir, file), "utf8");
    const url =
      src.match(/buildSearchUrl:\s*\(model\)\s*=>\s*`([^`]+)`/)?.[1] ??
      src.match(/const buildMikrotikSearchUrl[\s\S]*?`([^`]+)`/)?.[1];
    const selector =
      src.match(/findPriceElement\(\s*\$\s*,\s*"([^"]+)"/)?.[1] ??
      src.match(/\$\(\s*"([^"]*(?:price|Price)[^"]*)"\s*\)/)?.[1];
    if (url) out.set(name, { url, selector: selector ?? "" });
  }
  return out;
}

async function rustParsers(): Promise<Map<string, { url: string; selector: string }>> {
  const dir = "desktop/src-tauri/src/scrapers";
  const out = new Map<string, { url: string; selector: string }>();
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".rs") || file === "mod.rs" || file === "browser.rs") continue;
    const name = file.slice(0, -3);
    const src = await readFile(path.join(dir, file), "utf8");
    const url = src.match(/let url = format!\("([^"]+)"/)?.[1];
    const selector = src.match(
      /parse_price_page\(\s*html,\s*url,\s*model,\s*"[A-Z]{3}",\s*"([^"]+)"/,
    )?.[1];
    if (url) out.set(name, { url: url.replace("{}", ""), selector: selector ?? "" });
  }
  return out;
}

describe("desktop/mobile scraper parity", () => {
  it("every Rust parser uses the same search host+path as mobile", async () => {
    const mobile = await mobileParsers();
    const rust = await rustParsers();
    expect(rust.size).toBeGreaterThan(20);
    for (const [name, r] of rust) {
      const m = mobile.get(name);
      if (!m) continue;
      const normalize = (u: string) =>
        u
          .replace("${encodeURIComponent(model)}", "")
          .replace(/^https?:\/\/(www\.)?/, "")
          .replace(/\/$/, "");
      expect(normalize(r.url), `${name} search URL drifted`).toBe(
        normalize(m.url),
      );
    }
  });

  it("every Rust parser uses the same price selector as mobile", async () => {
    const mobile = await mobileParsers();
    const rust = await rustParsers();
    for (const [name, r] of rust) {
      const m = mobile.get(name);
      if (!m || !m.selector) continue;
      expect(r.selector, `${name} price selector drifted`).toBe(m.selector);
    }
  });
});
