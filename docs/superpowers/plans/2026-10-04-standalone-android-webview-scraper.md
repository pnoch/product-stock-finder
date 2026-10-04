# Standalone Android WebView Price Renderer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make price refresh work for all 25 distributor parsers on Android with no backend by rendering JS / Cloudflare-protected pages in a hidden on-device WebView and feeding the rendered HTML to the existing parsers.

**Architecture:** A hidden `react-native-webview` (mounted once in `app/_layout.tsx`) is exposed through a framework-free controller singleton (`lib/scrapers/webview-host.ts`). A native `browser` implementation (`lib/scrapers/browser-native.ts`) satisfies the same export surface as `browser.ts`, so `resilient.ts` and every parser are unchanged. `scripts/metro-resolver.js` points native builds at `browser-native.ts` (Playwright stays out of every Expo bundle).

**Tech Stack:** Expo SDK 54 / React Native 0.81, `react-native-webview`, TypeScript strict, vitest (+ @testing-library/react for the host component).

**Spec:** `docs/superpowers/specs/2026-10-04-standalone-android-webview-scraper-design.md`

---

## File Structure

- Create `lib/scrapers/webview-host.ts` — controller singleton + `buildInjectedJS` (pure).
- Create `lib/scrapers/browser-native.ts` — native `fetchWithBrowser`/`browserPool`/`teardownBrowserSession`.
- Create `components/webview-fetch-host.tsx` — hidden WebView + serial request queue.
- Modify `app/_layout.tsx` — mount `<WebViewFetchHost />`.
- Modify `scripts/metro-resolver.js` — native redirect to `browser-native.ts`.
- Modify `tests/metro-resolver.test.ts`, `tests/scrapers/browser-web.test.ts` — expectations.
- Create `tests/scrapers/webview-host.test.ts`, `tests/scrapers/browser-native.test.ts`, `tests/webview-fetch-host.test.tsx`.

---

### Task 1: Add the `react-native-webview` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install via Expo so the version matches SDK 54**

Run: `npx expo install react-native-webview`
Expected: `package.json` gains `"react-native-webview": "13.x"` (SDK-54-pinned) and the install succeeds.

- [ ] **Step 2: Confirm it resolves**

Run: `node -e "console.log(require('react-native-webview/package.json').version)"`
Expected: a `13.x` version string.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(android): add react-native-webview for on-device rendering"
```

---

### Task 2: Controller singleton + injected JS

**Files:**
- Create: `lib/scrapers/webview-host.ts`
- Test: `tests/scrapers/webview-host.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/webview-host.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  setWebViewHost,
  getWebViewHost,
  requireWebViewHost,
  buildInjectedJS,
} from "@/lib/scrapers/webview-host";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("webview-host registry", () => {
  beforeEach(() => setWebViewHost(null));

  it("has no host by default and requireWebViewHost throws", () => {
    expect(getWebViewHost()).toBeNull();
    expect(() => requireWebViewHost()).toThrow(BrowserUnavailableError);
  });

  it("returns the registered host", async () => {
    const load = vi.fn(async () => "<html></html>");
    setWebViewHost({ load });
    expect(getWebViewHost()).toBe(requireWebViewHost());
    await expect(requireWebViewHost().load("https://x")).resolves.toBe(
      "<html></html>",
    );
  });
});

describe("buildInjectedJS", () => {
  it("posts the rendered HTML back to React Native", () => {
    const js = buildInjectedJS({ timeoutMs: 20000, settleMs: 500 });
    expect(js).toContain("window.ReactNativeWebView.postMessage");
    expect(js).toContain("document.documentElement.outerHTML");
  });

  it("encodes the optional waitForSelector", () => {
    const js = buildInjectedJS({
      waitForSelector: ".price",
      timeoutMs: 20000,
      settleMs: 500,
    });
    expect(js).toContain('".price"');
    expect(buildInjectedJS({ timeoutMs: 1, settleMs: 0 })).toContain("null");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/webview-host.test.ts`
Expected: FAIL — "Cannot find module '@/lib/scrapers/webview-host'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scrapers/webview-host.ts
import { BrowserUnavailableError } from "./resilient";

export interface WebViewLoadOptions {
  waitForSelector?: string;
  timeoutMs?: number;
}

export interface WebViewHost {
  load(url: string, opts?: WebViewLoadOptions): Promise<string>;
}

export const WEBVIEW_UNAVAILABLE_MESSAGE =
  "on-device webview renderer unavailable";

let host: WebViewHost | null = null;

export function setWebViewHost(next: WebViewHost | null): void {
  host = next;
}

export function getWebViewHost(): WebViewHost | null {
  return host;
}

export function requireWebViewHost(): WebViewHost {
  if (!host) throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  return host;
}

// Runs in the page after it loads: wait (up to timeoutMs) for an optional
// selector, let late XHR prices settle, then post the full rendered HTML back.
export function buildInjectedJS(opts: {
  waitForSelector?: string;
  timeoutMs: number;
  settleMs: number;
}): string {
  const sel = JSON.stringify(opts.waitForSelector ?? null);
  return `(function(){
  var sel = ${sel};
  var deadline = Date.now() + ${opts.timeoutMs};
  function done(){ window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); }
  function ready(){ return !sel || !!document.querySelector(sel); }
  function wait(){
    if (ready()) { setTimeout(done, ${opts.settleMs}); }
    else if (Date.now() < deadline) { setTimeout(wait, 250); }
    else { done(); }
  }
  wait();
})(); true;`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/webview-host.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/webview-host.ts tests/scrapers/webview-host.test.ts
git commit -m "feat(scrapers): webview host registry + injected extraction script"
```

---

### Task 3: Native browser module

**Files:**
- Create: `lib/scrapers/browser-native.ts`
- Test: `tests/scrapers/browser-native.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/browser-native.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as native from "@/lib/scrapers/browser-native";
import { setWebViewHost } from "@/lib/scrapers/webview-host";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("browser-native", () => {
  beforeEach(() => setWebViewHost(null));

  it("throws BrowserUnavailableError when no host is mounted", async () => {
    await expect(native.fetchWithBrowser("https://x")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });

  it("delegates to the mounted host with options", async () => {
    const load = vi.fn(async () => "<html>ok</html>");
    setWebViewHost({ load });
    await expect(
      native.fetchWithBrowser("https://x", { waitForSelector: ".p", timeoutMs: 5000 }),
    ).resolves.toBe("<html>ok</html>");
    expect(load).toHaveBeenCalledWith("https://x", {
      waitForSelector: ".p",
      timeoutMs: 5000,
    });
  });

  it("has the same export surface as the node browser module", async () => {
    const real = await import("@/lib/scrapers/browser");
    for (const key of Object.keys(real)) {
      expect(Object.keys(native), `missing ${key}`).toContain(key);
    }
  });

  it("teardown releases", async () => {
    const release = vi.fn();
    await native.teardownBrowserSession(undefined, undefined, release);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/browser-native.test.ts`
Expected: FAIL — "Cannot find module '@/lib/scrapers/browser-native'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scrapers/browser-native.ts
//
// Android/iOS replacement for the Playwright-backed browser.ts, selected by
// scripts/metro-resolver.js. Rendering is done by the hidden WebView host
// (components/webview-fetch-host.tsx); this module only adapts the fetch call
// to the same surface resilient.ts expects.
import { BrowserUnavailableError } from "./resilient";
import { requireWebViewHost, WEBVIEW_UNAVAILABLE_MESSAGE } from "./webview-host";

export const browserPool = {
  async acquire(): Promise<never> {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
  release(_browser: unknown): void {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
  async shutdown(): Promise<void> {
    throw new BrowserUnavailableError(WEBVIEW_UNAVAILABLE_MESSAGE);
  },
};

export async function fetchWithBrowser(
  url: string,
  options?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  return requireWebViewHost().load(url, options);
}

export async function teardownBrowserSession(
  _page: { close(): Promise<void> } | undefined,
  _context: { close(): Promise<void> } | undefined,
  release: () => void,
): Promise<void> {
  // The WebView host owns its own lifecycle; nothing native to tear down.
  release();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/browser-native.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/browser-native.ts tests/scrapers/browser-native.test.ts
git commit -m "feat(scrapers): native browser module delegating to the webview host"
```

---

### Task 4: Hidden WebView host component

**Files:**
- Create: `components/webview-fetch-host.tsx`
- Test: `tests/webview-fetch-host.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/webview-fetch-host.test.tsx
// @vitest-environment jsdom
import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

const wvProps = vi.hoisted(() => ({ current: null as any }));
vi.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    wvProps.current = props;
    return React.createElement("div");
  },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...rest }: any) =>
      React.createElement("div", rest, children),
  };
});

import { WebViewFetchHost } from "@/components/webview-fetch-host";
import { getWebViewHost } from "@/lib/scrapers/webview-host";

describe("WebViewFetchHost", () => {
  beforeEach(() => {
    wvProps.current = null;
  });

  it("registers a host and resolves the posted HTML", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost();
    expect(host).not.toBeNull();

    const pending = host!.load("https://example.com", { waitForSelector: ".price" });
    await act(async () => {});
    expect(wvProps.current?.source?.uri).toBe("https://example.com");
    expect(String(wvProps.current?.injectedJavaScript)).toContain(".price");

    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "<html>x</html>" } });
    });
    await expect(pending).resolves.toBe("<html>x</html>");
  });

  it("rejects when the WebView errors", async () => {
    render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://x.test");
    await act(async () => {});
    act(() => {
      wvProps.current.onError({ nativeEvent: { description: "boom" } });
    });
    await expect(pending).rejects.toThrow("boom");
  });

  it("serializes requests, one WebView load at a time", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const a = host.load("https://a.test");
    const b = host.load("https://b.test");
    await act(async () => {});
    expect(wvProps.current.source.uri).toBe("https://a.test");

    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "A" } });
    });
    await expect(a).resolves.toBe("A");

    await act(async () => {});
    expect(wvProps.current.source.uri).toBe("https://b.test");
    act(() => {
      wvProps.current.onMessage({ nativeEvent: { data: "B" } });
    });
    await expect(b).resolves.toBe("B");
  });

  it("rejects queued work when unmounted", async () => {
    const { unmount } = render(<WebViewFetchHost />);
    const pending = getWebViewHost()!.load("https://x.test");
    await act(async () => {});
    unmount();
    await expect(pending).rejects.toThrow();
    expect(getWebViewHost()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/webview-fetch-host.test.tsx`
Expected: FAIL — "Cannot find module '@/components/webview-fetch-host'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/webview-fetch-host.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import {
  buildInjectedJS,
  setWebViewHost,
  type WebViewHost,
  type WebViewLoadOptions,
} from "@/lib/scrapers/webview-host";

const DEFAULT_TIMEOUT_MS = 20_000;
const SETTLE_MS = 500;
const MAX_QUEUE = 25;

interface PendingRequest {
  url: string;
  waitForSelector?: string;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (err: Error) => void;
}

/**
 * Mounted once at the app root. Owns a single hidden WebView that renders
 * distributor pages (JS / Cloudflare challenges) and posts the rendered HTML
 * back, so on-device scraping can reuse the existing parsers. Requests are
 * serialized: one page load at a time. Nothing renders when idle.
 */
export function WebViewFetchHost() {
  const [active, setActive] = useState<PendingRequest | null>(null);
  const queueRef = useRef<PendingRequest[]>([]);
  const activeRef = useRef<PendingRequest | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pump = useCallback(() => {
    if (activeRef.current) return;
    const next = queueRef.current.shift();
    if (!next) return;
    activeRef.current = next;
    setActive(next);
    timerRef.current = setTimeout(() => {
      const req = activeRef.current;
      activeRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setActive(null);
      req?.reject(new Error("webview render timed out"));
      pump();
    }, next.timeoutMs);
  }, []);

  const finish = useCallback(
    (html: string | null, error: Error | null) => {
      const req = activeRef.current;
      if (!req) return;
      activeRef.current = null;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setActive(null);
      if (error) req.reject(error);
      else req.resolve(html ?? "");
      pump();
    },
    [pump],
  );

  useEffect(() => {
    const host: WebViewHost = {
      load(url: string, opts?: WebViewLoadOptions) {
        return new Promise<string>((resolve, reject) => {
          if (queueRef.current.length >= MAX_QUEUE) {
            reject(new Error("webview queue full"));
            return;
          }
          queueRef.current.push({
            url,
            waitForSelector: opts?.waitForSelector,
            timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            resolve,
            reject,
          });
          pump();
        });
      },
    };
    setWebViewHost(host);
    return () => {
      setWebViewHost(null);
      const err = new Error("webview host unmounted");
      for (const req of queueRef.current) req.reject(err);
      queueRef.current = [];
      if (activeRef.current) {
        activeRef.current.reject(err);
        activeRef.current = null;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [pump]);

  if (!active) return null;

  return (
    <View
      style={{ width: 0, height: 0, overflow: "hidden" }}
      pointerEvents="none"
    >
      <WebView
        source={{ uri: active.url }}
        originWhitelist={["*"]}
        javaScriptEnabled
        injectedJavaScript={buildInjectedJS({
          waitForSelector: active.waitForSelector,
          timeoutMs: active.timeoutMs,
          settleMs: SETTLE_MS,
        })}
        onMessage={(event) => finish(event.nativeEvent.data, null)}
        onError={(event) =>
          finish(null, new Error(event.nativeEvent.description || "webview error"))
        }
        onHttpError={(event) =>
          finish(
            null,
            new Error(`webview HTTP ${event.nativeEvent.statusCode}`),
          )
        }
      />
    </View>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/webview-fetch-host.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/webview-fetch-host.tsx tests/webview-fetch-host.test.tsx
git commit -m "feat(scrapers): hidden webview fetch host with serialized queue"
```

---

### Task 5: Mount the host at the app root

**Files:**
- Modify: `app/_layout.tsx` (inside the `content` tree, ~line 421-431)
- Test: `tests/webview-mounted-source-guard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/webview-mounted-source-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("root layout mounts the webview fetch host", () => {
  const src = readFileSync(path.join(process.cwd(), "app/_layout.tsx"), "utf8");
  it("imports and renders WebViewFetchHost exactly once", () => {
    expect(src).toContain('from "@/components/webview-fetch-host"');
    expect(src.match(/<WebViewFetchHost \/>/g)?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/webview-mounted-source-guard.test.ts`
Expected: FAIL (string not found).

- [ ] **Step 3: Add the import and render**

Add the import near the other component imports in `app/_layout.tsx`:

```ts
import { WebViewFetchHost } from "@/components/webview-fetch-host";
```

Render it as a sibling of `<Stack>` inside the provider tree (always mounted once the app renders):

```tsx
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <WebViewFetchHost />
          <StatusBar style="auto" />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/webview-mounted-source-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx tests/webview-mounted-source-guard.test.ts
git commit -m "feat(android): mount the webview fetch host at the app root"
```

---

### Task 6: Point native builds at `browser-native.ts`

**Files:**
- Modify: `scripts/metro-resolver.js`
- Modify: `tests/metro-resolver.test.ts`

- [ ] **Step 1: Update the test to the new expectation**

Replace the `BROWSER_STUB_PATH` import/uses in `tests/metro-resolver.test.ts` with both paths and assert native → native, web → null (unredirected):

```ts
// tests/metro-resolver.test.ts
import { describe, expect, it } from "vitest";
import {
  resolveBrowserModulePath,
  BROWSER_STUB_PATH,
  BROWSER_NATIVE_PATH,
} from "../scripts/metro-resolver";

describe("resolveBrowserModulePath", () => {
  const request = "/repo/lib/scrapers/browser";
  const utilsOrigin = "/repo/lib/scrapers/utils.ts";

  it("redirects browser.ts to the native module on android/ios", () => {
    expect(resolveBrowserModulePath("android", request)).toBe(BROWSER_NATIVE_PATH);
    expect(resolveBrowserModulePath("ios", request)).toBe(BROWSER_NATIVE_PATH);
  });

  it("matches the real dynamic import from a lib/scrapers module", () => {
    expect(
      resolveBrowserModulePath("android", "./browser", "/repo/lib/scrapers/resilient.ts"),
    ).toBe(BROWSER_NATIVE_PATH);
  });

  it("does not redirect ./browser imported from elsewhere", () => {
    expect(
      resolveBrowserModulePath("android", "./browser", "/repo/components/foo.tsx"),
    ).toBeNull();
  });

  it("leaves web alone (the .web.ts variant resolves normally)", () => {
    expect(resolveBrowserModulePath("web", request)).toBeNull();
    expect(resolveBrowserModulePath("web", "./browser", utilsOrigin)).toBeNull();
  });

  it("ignores unrelated requests on native", () => {
    expect(resolveBrowserModulePath("android", "/repo/lib/scrapers/utils")).toBeNull();
  });

  it("still exports the web stub path", () => {
    expect(BROWSER_STUB_PATH.endsWith("lib/scrapers/browser.web.ts")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/metro-resolver.test.ts`
Expected: FAIL — `BROWSER_NATIVE_PATH` is not exported / expectations mismatch.

- [ ] **Step 3: Update the resolver**

In `scripts/metro-resolver.js`, add the native path constant and return it for native:

```js
const STUB_PATH = path.join(__dirname, "..", "lib", "scrapers", "browser.web.ts");
const NATIVE_PATH = path.join(__dirname, "..", "lib", "scrapers", "browser-native.ts");
```

```js
function resolveBrowserModulePath(platform, request, originModulePath) {
  if (platform !== "ios" && platform !== "android") return null;
  if (!isBrowserModule(request, originModulePath)) return null;
  // A real on-device WebView renderer (browser-native.ts), not the Playwright
  // module — Playwright must never enter an Expo bundle.
  return NATIVE_PATH;
}
```

```js
module.exports.BROWSER_NATIVE_PATH = NATIVE_PATH;
```

Update the file's header comment: native → `browser-native.ts`; web → `browser.web.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/metro-resolver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/metro-resolver.js tests/metro-resolver.test.ts
git commit -m "build(android): resolve lib/scrapers/browser to the native webview module"
```

---

### Task 7: Web-bundle guards

**Files:**
- Modify: `tests/scrapers/browser-web.test.ts`

- [ ] **Step 1: Extend the guard test**

Add a test that the native module surface exists and that only `browser-native.ts` references `react-native-webview`:

```ts
describe("native browser module", () => {
  it("browser-native.ts has the same surface as browser.ts", async () => {
    const real = await import("@/lib/scrapers/browser");
    const native = await import("@/lib/scrapers/browser-native");
    for (const key of Object.keys(real)) {
      expect(Object.keys(native), `native missing ${key}`).toContain(key);
    }
  });

  it("only browser-native.ts references react-native-webview", async () => {
    const roots = [
      path.resolve(__dirname, "../../lib"),
      path.resolve(__dirname, "../../app"),
      path.resolve(__dirname, "../../components"),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of await listTsFiles(root)) {
        const rel = path.relative(path.resolve(__dirname, "../.."), file);
        if (rel === "components/webview-fetch-host.tsx") continue;
        const src = await readFile(file, "utf-8");
        if (/from\s+["']react-native-webview["']/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard**

Run: `pnpm exec vitest run tests/scrapers/browser-web.test.ts`
Expected: PASS (the mock module name is only in `components/webview-fetch-host.tsx`).

- [ ] **Step 3: Commit**

```bash
git add tests/scrapers/browser-web.test.ts
git commit -m "test(scrapers): guard the native browser surface + webview import"
```

---

### Task 8: Full verification + APK

**Files:** none (verification)

- [ ] **Step 1: Typecheck + lint**

Run: `pnpm check && pnpm lint`
Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Full local gate**

Run: `pnpm verify`
Expected: all green; note the coverage numbers for the phase log.

- [ ] **Step 3: Regenerate the Android project and build the APK**

Run: `npx expo prebuild --platform android --no-install && pnpm build:apk`
Expected: BUILD SUCCESSFUL; `android/app/build/outputs/apk/release/app-release.apk` exists.

- [ ] **Step 4: Confirm the renderer is wired and Playwright is absent**

Run:
```bash
grep -c "react-native-webview" android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle || true
grep -c "playwright" android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle || true
```
Expected: `react-native-webview` present (non-zero); `playwright` absent (0, or only an unrelated substring — inspect if not 0).

- [ ] **Step 5: Commit any lockfile/prebuild-driven changes and document**

Add a Phase entry to `todo.md` summarizing the rollout and the foreground-only caveat, then:
```bash
git add todo.md
git commit -m "docs: standalone webview renderer rollout (Phase NNNN)"
```

---

## Self-Review

- **Spec coverage:** host controller (Task 2), native module (Task 3), hidden host + queue (Task 4), root mount (Task 5), Metro redirect (Task 6), guards (Task 7), verification/APK (Task 8). Foreground-only and no-background-service are honoured (no background code). Consent dismissal is intentionally deferred to a per-site validation follow-up (noted in the spec's risks).
- **Placeholders:** none.
- **Type consistency:** `WebViewHost.load(url, opts) → Promise<string>`, `buildInjectedJS({waitForSelector?, timeoutMs, settleMs})`, and `fetchWithBrowser(url, {waitForSelector?, timeoutMs?})` are used consistently across tasks. `BROWSER_NATIVE_PATH` is exported and consumed in Task 6.
