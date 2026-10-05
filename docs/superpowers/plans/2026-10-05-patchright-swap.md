# Patchright + System Chrome Swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the server browser driver from Playwright to Patchright and launch the system Chrome (`channel: "chrome"`) with a bundled-Chromium fallback, to pass more Cloudflare/anti-bot gates.

**Architecture:** `patchright` is a drop-in Playwright fork (same `chromium`/`Browser`/`BrowserContext` API), so only the import specifier changes in `lib/scrapers/browser.ts` and `scripts/smoke-web.ts`. A `launchBrowser()` helper tries `channel: "chrome"` then falls back to bundled Chromium. The mobile/web/desktop paths are untouched.

**Tech Stack:** Node/TS, `patchright@^1.63.0`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-patchright-swap-design.md`

---

## File Structure

- Modify `package.json` / `pnpm-lock.yaml` — swap the dependency.
- Modify `lib/scrapers/browser.ts` — import from `patchright`; add `launchBrowser()`.
- Modify `scripts/smoke-web.ts` — import from `patchright`.
- Modify `tests/scrapers/browser-web.test.ts` — driver guard.
- Create `tests/scrapers/browser-launch.test.ts` — fallback behavior.
- Modify `.github/workflows/ci.yml` — `patchright install`.

---

### Task 1: Swap the dependency and imports

**Files:** `package.json`, `pnpm-lock.yaml`, `lib/scrapers/browser.ts:1`, `scripts/smoke-web.ts:8`, `tests/scrapers/browser-web.test.ts`

- [ ] **Step 1: Install patchright, remove playwright**

Run:
```bash
pnpm add -w -E patchright@1.63.0
pnpm remove -w playwright
```
Expected: `package.json` gains `"patchright": "1.63.0"` and drops `"playwright"`.

- [ ] **Step 2: Point the imports at patchright**

In `lib/scrapers/browser.ts`, change line 1:
```ts
import { chromium, Browser, BrowserContext } from "patchright";
```

In `scripts/smoke-web.ts`, change the import:
```ts
import { chromium } from "patchright";
```

- [ ] **Step 3: Update the web-bundle guard**

In `tests/scrapers/browser-web.test.ts`, replace the `describe("playwright web-bundle guard", ...)` block with a driver guard:

```ts
describe("browser driver web-bundle guard", () => {
  it("only browser.ts statically imports a browser driver, and it is patchright", async () => {
    const roots = [
      path.resolve(__dirname, "../../lib"),
      path.resolve(__dirname, "../../app"),
      path.resolve(__dirname, "../../components"),
      path.resolve(__dirname, "../../hooks"),
      path.resolve(__dirname, "../../shared"),
    ];
    const offenders: string[] = [];
    let playwrightImports = 0;
    for (const root of roots) {
      for (const file of await listTsFiles(root)) {
        const rel = path.relative(path.resolve(__dirname, "../.."), file);
        const src = await readFile(file, "utf-8");
        if (/\bfrom\s+["']playwright["']/.test(src) || /\brequire\(\s*["']playwright["']\s*\)/.test(src)) {
          playwrightImports++;
        }
        if (rel === "lib/scrapers/browser.ts") continue;
        if (
          /\bfrom\s+["']patchright["']/.test(src) ||
          /\brequire\(\s*["']patchright["']\s*\)/.test(src)
        ) {
          offenders.push(rel);
        }
      }
    }
    expect(playwrightImports).toBe(0);
    expect(offenders).toEqual([]);
  });

  it("the web stub variant exists for Metro to resolve on web", async () => {
    const files = await readdir(SCRAPERS_DIR);
    expect(files).toContain("browser.web.ts");
  });
});
```

- [ ] **Step 4: Verify**

Run: `pnpm check && pnpm exec vitest run tests/scrapers/browser-web.test.ts`
Expected: 0 type errors; the guard passes.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml lib/scrapers/browser.ts scripts/smoke-web.ts tests/scrapers/browser-web.test.ts
git commit -m "build: swap playwright for patchright in the server browser path"
```

---

### Task 2: Launch system Chrome with a bundled fallback

**Files:** Modify `lib/scrapers/browser.ts`; Test `tests/scrapers/browser-launch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/browser-launch.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const launch = vi.fn();
vi.mock("patchright", () => ({
  chromium: { launch: (...a: unknown[]) => launch(...a) },
}));

import { launchBrowser } from "@/lib/scrapers/browser";

describe("launchBrowser", () => {
  beforeEach(() => launch.mockReset());

  it("uses system Chrome when available", async () => {
    const chrome = { isConnected: () => true };
    launch.mockResolvedValueOnce(chrome);
    await expect(launchBrowser()).resolves.toBe(chrome);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0]).toMatchObject({ headless: true, channel: "chrome" });
  });

  it("falls back to bundled Chromium when system Chrome is absent", async () => {
    const bundled = { isConnected: () => true };
    launch.mockRejectedValueOnce(new Error("channel chrome not found"));
    launch.mockResolvedValueOnce(bundled);
    await expect(launchBrowser()).resolves.toBe(bundled);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(launch.mock.calls[1][0]).not.toHaveProperty("channel");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/browser-launch.test.ts`
Expected: FAIL — `launchBrowser` is not exported.

- [ ] **Step 3: Add `launchBrowser` and use it in `acquire`**

In `lib/scrapers/browser.ts`, add above `class BrowserPool`:

```ts
const LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-dev-shm-usage",
  "--no-sandbox",
  "--disable-web-security",
  "--disable-features=IsolateOrigins,site-per-process",
];

// Prefer the host's real Chrome (its TLS/JA4 and version shape pass more
// anti-bot gates than bundled Chromium); fall back when Chrome isn't installed.
export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true, channel: "chrome", args: LAUNCH_ARGS });
  } catch {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  }
}
```

Replace the `chromium.launch({...})` call inside `acquire` (the `if (shouldLaunch)` block) with `return await launchBrowser();`, keeping the surrounding try/catch that decrements `checkedOut` and throws `Failed to launch browser`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/browser-launch.test.ts tests/scrapers/browser-web.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/browser.ts tests/scrapers/browser-launch.test.ts
git commit -m "feat(scrapers): launch system Chrome with a bundled fallback"
```

---

### Task 3: CI installs patchright's Chromium

**Files:** Modify `.github/workflows/ci.yml`

- [ ] **Step 1: Update the CI step**

Replace:
```yaml
      - run: npx playwright install --with-deps chromium
```
with:
```yaml
      - run: npx patchright install --with-deps chromium
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: install patchright chromium for the web smoke test"
```

---

### Task 4: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Gate**

Run: `pnpm check && pnpm lint && pnpm verify`
Expected: green (root tests + desktop + cargo).

- [ ] **Step 2: Confirm no playwright remains**

Run: `grep -rn "\"playwright\"" package.json || echo "playwright removed"`
Expected: `playwright removed`.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry: the Patchright swap, the `channel: "chrome"` + fallback, and the note that the live Cloudflare pass-rate gain is only measurable against real targets. Commit `docs: patchright browser driver swap (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** dependency swap (Task 1), `channel: "chrome"` + fallback (Task 2), guard (Task 1), CI (Task 3), smoke import (Task 1), verify/docs (Task 4). Plain-HTTP/`impit`, mobile, and desktop are explicitly out of scope.
- **Placeholders:** none.
- **Type consistency:** `launchBrowser(): Promise<Browser>` is exported and used by `acquire`; the guard allows `patchright` only in `lib/scrapers/browser.ts`; `chromium` is imported from `patchright` in both `browser.ts` and `smoke-web.ts`.
