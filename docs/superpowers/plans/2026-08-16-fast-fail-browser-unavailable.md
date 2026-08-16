# Fast-Fail Browser-Unavailable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the ~3s retry penalty when the playwright browser module is unavailable on the client, by fast-failing deterministic import failures so the plain fallback runs immediately.

**Architecture:** In `lib/scrapers/resilient.ts`, introduce an exported `BrowserUnavailableError` and a module-scope `browserUnavailableReason` cache. `fetchBrowser` throws `BrowserUnavailableError` when the dynamic `import("./browser")` fails (and short-circuits on the cached reason thereafter). `attemptMethod`'s browser catch breaks the retry loop on `BrowserUnavailableError` instead of retrying. Transient browser call errors (server) keep their existing retry behavior.

**Tech Stack:** TypeScript strict, vitest, ESLint. Node 20 (supports `ErrorOptions`/`cause`).

**Design:** `docs/superpowers/specs/2026-08-16-fast-fail-browser-unavailable-design.md` (approved).

---

### Task 1: Fast-fail browser-unavailable in `resilientFetch`

**Files:**
- Modify: `lib/scrapers/resilient.ts:123-129` (`fetchBrowser`) and `:154-196` (`attemptMethod`)
- Test: `tests/resilient-fetch.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/resilient-fetch.test.ts` (inside the existing `describe("resilientFetch", ...)` block, after the "falls back to plain when browser is unavailable" test). Add `BrowserUnavailableError` to the import from `../lib/scrapers/resilient`:

```ts
import {
  classifyFetchStatus,
  createMemoryBreakerStore,
  createStorageBreakerStore,
  resilientFetch,
  BrowserUnavailableError,
  type BreakerEntry,
} from "../lib/scrapers/resilient";
```

Then append this test:

```ts
  it("fast-fails a browser-unavailable error without retrying", async () => {
    const fetchMock = vi.fn(
      async () => new Response("<html>price</html>", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    browserMock.fetchWithBrowser.mockRejectedValue(
      new BrowserUnavailableError("browser module unavailable"),
    );
    const state = createMemoryBreakerStore();
    const outcome = await resilientFetch({
      parser: makeParser({ useBrowser: true, browserOptions: { timeoutMs: 1000 } }),
      url: "https://example.com/search?q=CRS804",
      state,
      retryBaseMs: 1000,
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.method).toBe("plain");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/resilient-fetch.test.ts`
Expected: FAIL — `browserMock.fetchWithBrowser` is called 3 times (2 retries), not 1. (`BrowserUnavailableError` is not yet thrown by `fetchBrowser`, so the generic catch retries.)

- [ ] **Step 3: Implement**

In `lib/scrapers/resilient.ts`:

Replace the `fetchBrowser` function (currently lines 123-129):

```ts
async function fetchBrowser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  const { fetchWithBrowser } = await import("./browser");
  return fetchWithBrowser(url, parser.browserOptions);
}
```

with:

```ts
export class BrowserUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BrowserUnavailableError";
  }
}

let browserUnavailableReason: string | null = null;

async function fetchBrowser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  if (browserUnavailableReason) {
    throw new BrowserUnavailableError(browserUnavailableReason);
  }
  let mod: typeof import("./browser");
  try {
    mod = await import("./browser");
  } catch (error) {
    browserUnavailableReason = "browser module unavailable";
    throw new BrowserUnavailableError(browserUnavailableReason, {
      cause: error,
    });
  }
  return mod.fetchWithBrowser(url, parser.browserOptions);
}
```

In `attemptMethod`, replace the `catch (error)` block (currently lines 187-193):

```ts
    } catch (error) {
      last = {
        status: "error",
        method,
        error: error instanceof Error ? error.message : String(error),
      };
    }
```

with:

```ts
    } catch (error) {
      last = {
        status: "error",
        method,
        error: error instanceof Error ? error.message : String(error),
      };
      if (error instanceof BrowserUnavailableError) break;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/resilient-fetch.test.ts`
Expected: PASS — `fetchWithBrowser` called exactly once, plain fallback returns `ok`.

- [ ] **Step 5: Keep the existing transient-error test unchanged**

The existing test "falls back to plain when browser is unavailable" (currently around line 333) mocks `browserMock.fetchWithBrowser.mockRejectedValue(new Error("browser not available"))`. Leave it as-is — it exercises the transient browser-error retry path (generic error → retried → plain fallback), which the new fast-fail test does not cover. Do not modify it.

- [ ] **Step 6: Run the full resilient test file**

Run: `pnpm test -- tests/resilient-fetch.test.ts`
Expected: PASS — all 21 tests (20 existing + 1 new).

- [ ] **Step 7: Typecheck, lint, full suite**

Run: `pnpm check` — 0 TypeScript errors.
Run: `pnpm lint` — clean.
Run: `pnpm test` — 632 passed / 9 skipped.

- [ ] **Step 8: Commit**

```bash
git add lib/scrapers/resilient.ts tests/resilient-fetch.test.ts
git commit -m "Fast-fail browser-unavailable to avoid client retry penalty"
```
