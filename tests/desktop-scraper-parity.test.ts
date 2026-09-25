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
      // jQuery's `:contains()` is not understood by the `scraper` crate, so the
      // Rust engine translates it itself (scrapers/mod.rs `select_selector_list`)
      // and both sides must pass the same selector through.
      expect(r.selector, `${name} price selector drifted`).toBe(m.selector);
    }
  });

  it("keeps the Rust model matcher aligned with the shared parser rules", async () => {
    // The shared `matchesModel` rules the Rust port must mirror: a preceding
    // LETTER is a brand concatenation (allowed), a preceding DIGIT is not, and a
    // short commerce suffix is tolerated only after a trailing separator. The
    // Rust engine only understood the plain whole-token case, so it silently
    // reported "no price found" for cards the mobile parser handles.
    const rust = await readFile(
      "desktop/src-tauri/src/scrapers/mod.rs",
      "utf8",
    );
    expect(rust).toContain("fn text_mentions_model");
    expect(rust, "preceding-letter rule missing").toContain("is_ascii_alphabetic");
    expect(rust, "trailing-separator rule missing").toContain("[^a-z0-9]+?");
    expect(rust, "commerce-suffix rule missing").toContain("is_commerce_suffix");

    const suffixesOf = (src: string, block: RegExp): string[] => {
      const body = src.match(block)?.[1] ?? "";
      return [...body.matchAll(/"([a-z]{2})"/g)].map((m) => m[1]!).sort();
    };
    const ts = await readFile("lib/scrapers/utils.ts", "utf8");
    const tsSuffixes = suffixesOf(ts, /const COMMERCE_SUFFIXES = new Set\(\[([\s\S]*?)\]\)/);
    const rustSuffixes = suffixesOf(rust, /const COMMERCE_SUFFIXES: \[&str; \d+\] = \[([\s\S]*?)\]/);
    expect(tsSuffixes.length).toBeGreaterThan(5);
    expect(rustSuffixes).toEqual(tsSuffixes);

    // Both sides must keep the whitespace-less card corpus that caught this.
    const shared = await readFile("tests/scrapers/utils.test.ts", "utf8");
    expect(shared).toContain("MikroTikCRS326-24G-2S+IN");
    expect(rust).toContain("MikroTikCRS326-24G-2S+IN");
  });

  it("every Rust browser parser waits for the same selector as mobile", async () => {
    // A wait for a selector the page never renders used to fail the whole
    // browser fetch (see the soft-fail test below) and send the desktop down a
    // plain-HTML path that cannot contain JS-rendered results. The wait target
    // itself must match the shared per-distributor value.
    const dir = "lib/scrapers";
    let checked = 0;
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".ts")) continue;
      const name = file.slice(0, -3);
      const ts = await readFile(path.join(dir, file), "utf8");
      if (!/useBrowser:\s*true/.test(ts)) continue;
      const tsWait = ts.match(/waitForSelector:\s*"([^"]+)"/)?.[1] ?? null;
      const rust = await readFile(
        `desktop/src-tauri/src/scrapers/${name}.rs`,
        "utf8",
      );
      const rustWait =
        rust.match(/fetch_with_browser\(\s*[^,]+,\s*Some\("([^"]+)"\)/)?.[1] ?? null;
      checked++;
      expect(rustWait, `${name} browser wait selector drifted`).toBe(tsWait);
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("soft-fails a missing browser wait selector like the shared path", async () => {
    const browserRs = await readFile(
      "desktop/src-tauri/src/scrapers/browser.rs",
      "utf8",
    );
    expect(browserRs, "a missing selector must not fail the fetch").toMatch(
      /let _ = locator\.wait_for\(/,
    );
    expect(browserRs, "30s hard-fail wait is gone").not.toContain(
      "locator.wait_for(None)",
    );
  });
});
