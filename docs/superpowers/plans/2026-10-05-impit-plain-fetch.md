# `impit` Plain-HTTP Client (server-only) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the server's plain-HTTP fetches a Chrome-shaped TLS/JA4 fingerprint via `impit`, falling back to global `fetch` on mobile/web/tests.

**Architecture:** A new `lib/scrapers/plain-fetch.ts` chooses the client: `impit` (Chrome TLS shape) on the server, global `fetch` elsewhere (gated on `typeof window`/`NODE_ENV`/`VITEST`). The two plain call sites (`resilient.fetchPlain`, `utils.fetchWithRateLimit`) route through it. `impit` is lazily imported so it never enters the mobile/web bundle or the node test transform.

**Tech Stack:** Node/TS, `impit@0.14.5` (native curl-impersonate binding), vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-impit-plain-fetch-design.md`

---

## File Structure

- Create `lib/scrapers/plain-fetch.ts` — the client selector.
- Modify `lib/scrapers/resilient.ts` — `fetchPlain` uses `plainFetch`.
- Modify `lib/scrapers/utils.ts` — `fetchWithRateLimit` uses `plainFetch`.
- Create `tests/scrapers/plain-fetch.test.ts`, `tests/scrapers/impit-guard.test.ts`.
- Modify `package.json` / `pnpm-lock.yaml`.

---

### Task 1: Add the `impit` dependency

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `pnpm add -w -E impit@0.14.5`
Expected: `package.json` gains `"impit": "0.14.5"`; the native prebuilt binary downloads.

- [ ] **Step 2: Confirm it loads**

Run: `node -e "const { Impit } = require('impit'); const i = new Impit({ browser: 'chrome' }); console.log('impit ok', typeof i.fetch)"`
Expected: `impit ok function`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add impit for a Chrome-shaped TLS plain-HTTP client"
```

---

### Task 2: The `plainFetch` selector

**Files:** Create `lib/scrapers/plain-fetch.ts`; Test `tests/scrapers/plain-fetch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/plain-fetch.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const impitFetch = vi.fn(async () => ({
  status: 200,
  statusText: "OK",
  ok: true,
  text: async () => "<html>impit</html>",
}));
vi.mock("impit", () => ({
  Impit: class {
    fetch = impitFetch;
  },
}));

import { plainFetch } from "@/lib/scrapers/plain-fetch";

describe("plainFetch", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => impitFetch.mockClear());
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.VITEST;
    process.env.NODE_ENV = "test";
  });

  it("uses the global fetch under test (so fetch stubs keep working)", async () => {
    process.env.VITEST = "true";
    const stub = vi.fn(async () => new Response("<html>global</html>", { status: 200 }));
    globalThis.fetch = stub as unknown as typeof fetch;
    const res = await plainFetch("https://x.test");
    expect(await res.text()).toBe("<html>global</html>");
    expect(stub).toHaveBeenCalledTimes(1);
    expect(impitFetch).not.toHaveBeenCalled();
  });

  it("uses impit on the server path", async () => {
    delete process.env.VITEST;
    process.env.NODE_ENV = "production";
    const res = await plainFetch("https://x.test", { headers: { Accept: "text/html" } });
    expect(await res.text()).toBe("<html>impit</html>");
    expect(impitFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/plain-fetch.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scrapers/plain-fetch.ts
//
// The server fetches plain HTTP with `impit` (a Chrome-shaped TLS/JA4
// fingerprint), which passes TLS-fingerprint gates that undici does not.
// Mobile/web/tests use the global `fetch` so the React Native path and the
// fetch-stubbing test suite are unchanged. `impit` is imported lazily so it
// never enters the mobile/web bundle or the node test transform.

export interface PlainResponse {
  status: number;
  statusText: string;
  ok: boolean;
  text(): Promise<string>;
}

interface PlainInit {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function shouldUseImpit(): boolean {
  return (
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "test" &&
    !process.env.VITEST
  );
}

let impitInstance: { fetch: (url: string, init?: PlainInit) => Promise<PlainResponse> } | null =
  null;
let impitFailed = false;

async function getImpit() {
  if (impitInstance || impitFailed) return impitInstance;
  try {
    const { Impit } = await import("impit");
    impitInstance = new Impit({ browser: "chrome", timeout: 20_000 });
    return impitInstance;
  } catch {
    impitFailed = true;
    return null;
  }
}

export async function plainFetch(
  url: string,
  init?: PlainInit,
): Promise<PlainResponse> {
  if (shouldUseImpit()) {
    const impit = await getImpit();
    // A missing/unsupported impit falls back to global fetch; a request error
    // propagates so the caller's retry/breaker logic still applies.
    if (impit) return impit.fetch(url, init);
  }
  return fetch(url, init as RequestInit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/plain-fetch.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/plain-fetch.ts tests/scrapers/plain-fetch.test.ts
git commit -m "feat(scrapers): server-only impit plain-HTTP client with fetch fallback"
```

---

### Task 3: Route the plain call sites through `plainFetch`

**Files:** Modify `lib/scrapers/resilient.ts`, `lib/scrapers/utils.ts`

- [ ] **Step 1: Update `fetchPlain` in `lib/scrapers/resilient.ts`**

Add the import near the other `./` imports:
```ts
import { plainFetch } from "./plain-fetch";
```

Replace the foreground `await fetch(url, {...})` call with `await plainFetch(url, {...})` (the object shape is unchanged; `plainFetch` accepts `{ headers, signal }`). Leave the background branch (`backgroundFetch`) as-is — it uses the native XHR path, not `fetch`.

- [ ] **Step 2: Update `fetchWithRateLimit` in `lib/scrapers/utils.ts`**

Add the import:
```ts
import { plainFetch } from "./plain-fetch";
```

Replace both `await fetch(url, { headers: {...} })` calls (the background branch and the rate-limited branch) with `await plainFetch(url, { headers: {...} })`.

- [ ] **Step 3: Verify the existing suite**

Run: `pnpm exec vitest run tests/scrapers/ tests/fetch-timeout.test.ts tests/live-prices.test.ts`
Expected: PASS — the tests run under the test gate, so `plainFetch` delegates to the global `fetch` they stub.

- [ ] **Step 4: Commit**

```bash
git add lib/scrapers/resilient.ts lib/scrapers/utils.ts
git commit -m "feat(scrapers): route plain HTTP through the impit selector"
```

---

### Task 4: Guard + full verification + docs

**Files:** Create `tests/scrapers/impit-guard.test.ts`; `todo.md`

- [ ] **Step 1: Write the guard**

```ts
// tests/scrapers/impit-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("impit is server-only", () => {
  it("is imported only in lib/scrapers/plain-fetch.ts", () => {
    const root = path.resolve(__dirname, "../..");
    const offenders: string[] = [];
    for (const dir of ["lib", "app", "components", "hooks", "shared"]) {
      for (const file of walk(path.join(root, dir))) {
        const rel = path.relative(root, file);
        if (rel === "lib/scrapers/plain-fetch.ts") continue;
        const src = readFileSync(file, "utf-8");
        if (/from\s+["']impit["']/.test(src) || /import\(\s*["']impit["']\s*\)/.test(src)) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard + full gate**

Run: `pnpm exec vitest run tests/scrapers/impit-guard.test.ts && pnpm check && pnpm lint && pnpm verify`
Expected: guard passes; `pnpm verify` green.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry: the `impit` server plain-HTTP client, the server/mobile gate, and the note that the TLS-gate gain is only measurable against real targets. Commit `docs: impit plain-HTTP client (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** dependency (Task 1), selector + fallback + server gate (Task 2), call-site routing (Task 3), guard + verify + docs (Task 4). Mobile/web/desktop and the browser path are out of scope.
- **Placeholders:** none.
- **Type consistency:** `plainFetch(url, { headers?, signal? }): Promise<PlainResponse>` is used by `fetchPlain` (which reads `.text()`/`.status`) and `fetchWithRateLimit` (which reads `.ok`/`.status`/`.statusText`/`.text()`); `PlainResponse` covers all of them; the guard pins `impit` to `lib/scrapers/plain-fetch.ts`.
