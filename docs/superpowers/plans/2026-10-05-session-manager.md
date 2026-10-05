# Session Manager (per-domain clear + expiry) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user sign out of a single distributor (cookies + DOM storage), see which distributors have a session, and surface an expired session to re-unlock.

**Architecture:** A persisted "unlocked" set (AsyncStorage) records intent; `clearDistributorSession` expires that domain's cookies via `@react-native-cookies/cookies` and clears its `localStorage`/`sessionStorage` through a new `clearStorage` job on the existing hidden WebView host; a Settings "Site sessions" manager lists relevant distributors with Active/Expired/None hints.

**Tech Stack:** Expo SDK 54 / RN 0.81, `react-native-webview`, `@react-native-cookies/cookies`, AsyncStorage, TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-session-manager-design.md`

---

## File Structure

- Create `lib/scrapers/session-store.ts` — the unlocked set.
- Modify `lib/scrapers/webview-host.ts` — add `clearStorage` to `WebViewHost`, `buildClearStorageJS`, sentinel.
- Modify `components/webview-fetch-host.tsx` — implement `clearStorage` (a `clear` job mode).
- Modify `lib/scrapers/session-assist.ts` — `clearDistributorSession`, global `clearSiteData`.
- Modify `app/health.tsx` — `markUnlocked` on assist Done.
- Rewrite `components/settings/site-sessions-section.tsx` — the manager.
- Tests: `tests/scrapers/session-store.test.ts`, `tests/scrapers/webview-host-clear.test.ts`, `tests/webview-fetch-host.test.tsx` (extend), `tests/scrapers/session-assist-clear.test.ts`, `tests/session-assist-health-guard.test.ts` (extend), `tests/site-sessions-section.test.tsx` (rewrite).

---

### Task 1: Unlocked-set store

**Files:** Create `lib/scrapers/session-store.ts`; Test `tests/scrapers/session-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/session-store.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

import {
  getUnlocked,
  markUnlocked,
  clearUnlocked,
  clearAllUnlocked,
} from "@/lib/scrapers/session-store";

describe("session-store", () => {
  beforeEach(() => store.clear());

  it("starts empty and marks/clears a distributor", async () => {
    expect(await getUnlocked()).toEqual({});
    await markUnlocked("pbtech-nz");
    const after = await getUnlocked();
    expect(Object.keys(after)).toEqual(["pbtech-nz"]);
    expect(typeof after["pbtech-nz"]).toBe("string");
    await clearUnlocked("pbtech-nz");
    expect(await getUnlocked()).toEqual({});
  });

  it("clearAllUnlocked empties the set", async () => {
    await markUnlocked("a");
    await markUnlocked("b");
    await clearAllUnlocked();
    expect(await getUnlocked()).toEqual({});
  });

  it("tolerates corrupt stored JSON", async () => {
    store.set("session_unlocked", "{not json");
    expect(await getUnlocked()).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/session-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scrapers/session-store.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "session_unlocked";

// The set of distributors the user has explicitly unlocked (id -> ISO time).
// We persist intent rather than inferring from cookies, because distributor
// sites set analytics/consent cookies regardless of a login.
export async function getUnlocked(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export async function markUnlocked(id: string): Promise<void> {
  try {
    const current = await getUnlocked();
    current[id] = new Date().toISOString();
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // best-effort
  }
}

export async function clearUnlocked(id: string): Promise<void> {
  try {
    const current = await getUnlocked();
    delete current[id];
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // best-effort
  }
}

export async function clearAllUnlocked(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/session-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/session-store.ts tests/scrapers/session-store.test.ts
git commit -m "feat(scrapers): persisted unlocked-session set"
```

---

### Task 2: Host `clearStorage` capability

**Files:** Modify `lib/scrapers/webview-host.ts`; Test `tests/scrapers/webview-host-clear.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/webview-host-clear.test.ts
import { describe, expect, it } from "vitest";
import {
  buildClearStorageJS,
  STORAGE_CLEARED_SENTINEL,
} from "@/lib/scrapers/webview-host";

describe("buildClearStorageJS", () => {
  it("clears local + session storage and posts the sentinel", () => {
    const js = buildClearStorageJS();
    expect(js).toContain("localStorage.clear()");
    expect(js).toContain("sessionStorage.clear()");
    expect(js).toContain(STORAGE_CLEARED_SENTINEL);
    expect(js).toContain("window.ReactNativeWebView.postMessage");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/webview-host-clear.test.ts`
Expected: FAIL — exports missing.

- [ ] **Step 3: Add the capability**

In `lib/scrapers/webview-host.ts`, extend the `WebViewHost` interface and add the sentinel + script builder:

```ts
export interface WebViewHost {
  load(url: string, opts?: WebViewLoadOptions): Promise<string>;
  clearStorage(url: string): Promise<void>;
}

export const STORAGE_CLEARED_SENTINEL = "__psf_storage_cleared__";

// Runs in the page to sign out of the origin's DOM storage, then posts a
// sentinel the host resolves on.
export function buildClearStorageJS(): string {
  return `(function(){
  try { localStorage.clear(); sessionStorage.clear(); } catch(e){}
  window.ReactNativeWebView.postMessage(${JSON.stringify(STORAGE_CLEARED_SENTINEL)});
})(); true;`;
}
```

Because `clearStorage` is now required, update the two existing tests that register a fake host so they type-check. In `tests/scrapers/webview-host.test.ts` and `tests/scrapers/browser-native.test.ts`, change every `setWebViewHost({ load })` to:

```ts
    setWebViewHost({ load, clearStorage: async () => {} });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/scrapers/webview-host-clear.test.ts tests/scrapers/webview-host.test.ts tests/scrapers/browser-native.test.ts && pnpm check`
Expected: PASS (all), 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/webview-host.ts tests/scrapers/webview-host-clear.test.ts tests/scrapers/webview-host.test.ts tests/scrapers/browser-native.test.ts
git commit -m "feat(scrapers): webview host clearStorage capability"
```

---

### Task 3: Implement `clearStorage` in the host component

**Files:** Modify `components/webview-fetch-host.tsx`; Test `tests/webview-fetch-host.test.tsx` (extend)

- [ ] **Step 1: Write the failing test** (append to `tests/webview-fetch-host.test.tsx`)

```tsx
  it("clears DOM storage via a clear job", async () => {
    render(<WebViewFetchHost />);
    const host = getWebViewHost()!;
    const cleared = host.clearStorage("https://clear.test");
    await act(async () => {});
    const props = wvFor("https://clear.test");
    expect(String(props.injectedJavaScript)).toContain("localStorage.clear()");
    act(() => {
      props.onMessage({ nativeEvent: { data: "__psf_storage_cleared__" } });
    });
    await expect(cleared).resolves.toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/webview-fetch-host.test.tsx`
Expected: FAIL — `host.clearStorage is not a function`.

- [ ] **Step 3: Implement the clear job**

In `components/webview-fetch-host.tsx`:

1. Import the new helpers:
```tsx
import {
  buildClearStorageJS,
  buildInjectedJS,
  setWebViewHost,
  type WebViewHost,
  type WebViewLoadOptions,
} from "@/lib/scrapers/webview-host";
```

2. Add `mode` to `PendingRequest`:
```tsx
interface PendingRequest {
  id: number;
  url: string;
  mode: "html" | "clear";
  waitForSelector?: string;
  timeoutMs: number;
  resolve: (html: string) => void;
  reject: (err: Error) => void;
}
```

3. Replace the `host` object's `load` with an `enqueue` helper and add `clearStorage`:
```tsx
    function enqueue(
      url: string,
      mode: "html" | "clear",
      opts?: WebViewLoadOptions,
    ): Promise<string> {
      return new Promise<string>((resolve, reject) => {
        if (queue.length >= MAX_QUEUE) {
          reject(new BrowserUnavailableError("webview queue full"));
          return;
        }
        queue.push({
          id: nextIdRef.current++,
          url,
          mode,
          waitForSelector: opts?.waitForSelector,
          timeoutMs: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          resolve,
          reject,
        });
        pump();
      });
    }
    const host: WebViewHost = {
      load: (url, opts) => enqueue(url, "html", opts),
      clearStorage: (url) => enqueue(url, "clear").then(() => undefined),
    };
```

4. In the rendered `<WebView>`, choose the injected script by mode:
```tsx
            injectedJavaScript={
              req.mode === "clear"
                ? buildClearStorageJS()
                : buildInjectedJS({
                    waitForSelector: req.waitForSelector,
                    timeoutMs: req.timeoutMs,
                    settleMs: SETTLE_MS,
                  })
            }
```

(The `finish`/`onMessage` path is unchanged: a clear job resolves with the sentinel string, which `clearStorage` discards.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/webview-fetch-host.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add components/webview-fetch-host.tsx tests/webview-fetch-host.test.tsx
git commit -m "feat(scrapers): hidden host clearStorage job"
```

---

### Task 4: Per-domain + global clear

**Files:** Modify `lib/scrapers/session-assist.ts`; Test `tests/scrapers/session-assist-clear.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/session-assist-clear.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const get = vi.fn(async () => ({ sid: { name: "sid", value: "x", domain: "pbtech.co.nz" } }));
const set = vi.fn(async () => true);
const clearAll = vi.fn(async () => true);
vi.mock("@react-native-cookies/cookies", () => ({
  default: { get: (...a: unknown[]) => get(...a), set: (...a: unknown[]) => set(...a), clearAll: () => clearAll() },
}));

const clearStorage = vi.fn(async () => {});
vi.mock("@/lib/scrapers/webview-host", () => ({
  getWebViewHost: () => ({ clearStorage }),
}));

const clearUnlocked = vi.fn(async () => {});
const clearAllUnlocked = vi.fn(async () => {});
const getUnlocked = vi.fn(async () => ({ "pbtech-nz": "t" }));
vi.mock("@/lib/scrapers/session-store", () => ({
  clearUnlocked: (...a: unknown[]) => clearUnlocked(...a),
  clearAllUnlocked: () => clearAllUnlocked(),
  getUnlocked: () => getUnlocked(),
}));

import { clearDistributorSession, clearSiteData } from "@/lib/scrapers/session-assist";

const parser = { id: "pbtech-nz", baseUrl: "https://www.pbtech.co.nz" } as never;

describe("clearDistributorSession", () => {
  beforeEach(() => {
    get.mockClear(); set.mockClear(); clearStorage.mockClear(); clearUnlocked.mockClear();
  });

  it("expires the domain's cookies, clears DOM storage, and clears the flag", async () => {
    await clearDistributorSession(parser);
    expect(get).toHaveBeenCalledWith("https://www.pbtech.co.nz");
    expect(set).toHaveBeenCalledTimes(1);
    expect(clearStorage).toHaveBeenCalledWith("https://www.pbtech.co.nz");
    expect(clearUnlocked).toHaveBeenCalledWith("pbtech-nz");
  });
});

describe("clearSiteData", () => {
  it("clears all cookies, every unlocked origin's storage, and the set", async () => {
    clearAll.mockClear(); clearStorage.mockClear(); clearAllUnlocked.mockClear();
    await clearSiteData();
    expect(clearAll).toHaveBeenCalledTimes(1);
    expect(clearStorage).toHaveBeenCalledWith("https://www.pbtech.co.nz");
    expect(clearAllUnlocked).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/session-assist-clear.test.ts`
Expected: FAIL — `clearDistributorSession` missing.

- [ ] **Step 3: Implement**

In `lib/scrapers/session-assist.ts`, add imports and the two functions (replace the existing `clearSiteData`):

```ts
import { getWebViewHost } from "./webview-host";
import { clearUnlocked, clearAllUnlocked, getUnlocked } from "./session-store";
import { PARSERS } from "./registry";

// Sign out of ONE distributor: expire its cookies (the cookie lib's
// clearByName is iOS-only) and clear its DOM storage via the hidden host.
// Best-effort — never throws.
export async function clearDistributorSession(
  parser: DistributorParser,
): Promise<void> {
  const url = assistUrl(parser);
  try {
    const mod = await import("@react-native-cookies/cookies");
    const cookies = await mod.default.get(url);
    for (const cookie of Object.values(cookies)) {
      try {
        await mod.default.set(url, {
          ...cookie,
          expires: "1970-01-01T00:00:00.000Z",
        });
      } catch {
        // skip an individual cookie
      }
    }
  } catch {
    // cookie manager unavailable
  }
  try {
    await getWebViewHost()?.clearStorage(url);
  } catch {
    // no host mounted / clear failed
  }
  await clearUnlocked(parser.id);
}

// Sign out of every distributor site.
export async function clearSiteData(): Promise<void> {
  try {
    const mod = await import("@react-native-cookies/cookies");
    await mod.default.clearAll();
  } catch {
    // cookie manager unavailable
  }
  try {
    const unlocked = await getUnlocked();
    const host = getWebViewHost();
    if (host) {
      for (const id of Object.keys(unlocked)) {
        const parser = PARSERS.find((p) => p.id === id);
        if (parser) {
          try {
            await host.clearStorage(assistUrl(parser));
          } catch {
            // skip this origin
          }
        }
      }
    }
  } catch {
    // best-effort
  }
  await clearAllUnlocked();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/session-assist-clear.test.ts tests/scrapers/session-assist.test.ts`
Expected: PASS (the existing session-assist test still passes — `clearSiteData` still calls `clearAll`).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/session-assist.ts tests/scrapers/session-assist-clear.test.ts
git commit -m "feat(scrapers): per-distributor + global session clear"
```

---

### Task 5: Mark unlocked on assist Done

**Files:** Modify `app/health.tsx`; Test `tests/session-assist-health-guard.test.ts` (extend)

- [ ] **Step 1: Extend the guard test**

Add to `tests/session-assist-health-guard.test.ts`:
```ts
  it("marks the distributor unlocked when the assist completes", () => {
    expect(src).toContain("markUnlocked(");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/session-assist-health-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Wire it**

In `app/health.tsx`, import `markUnlocked` and call it at the top of `handleAssistDone` (after resolving `parserId`, before the re-probe):

```tsx
import { markUnlocked } from "@/lib/scrapers/session-store";
```

```tsx
  const handleAssistDone = useCallback(async () => {
    const parserId = assistParserId;
    setAssistParserId(null);
    if (!parserId) return;
    await markUnlocked(parserId);
    try {
      const result = await healthService.testDistributor(parserId);
      // ...unchanged
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm exec vitest run tests/session-assist-health-guard.test.ts && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add app/health.tsx tests/session-assist-health-guard.test.ts
git commit -m "feat(health): record unlocked distributors on assist Done"
```

---

### Task 6: Site sessions manager

**Files:** Rewrite `components/settings/site-sessions-section.tsx`; Test `tests/site-sessions-section.test.tsx` (rewrite)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/site-sessions-section.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown): unknown => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA", error: "#EF4444", success: "#00C896", warning: "#F59E0B" }),
}));
vi.mock("@/components/session-assist-modal", () => ({ SessionAssistModal: () => null }));

const getUnlocked = vi.fn(async () => ({ "pbtech-nz": "t" }));
const clearDistributorSession = vi.fn(async () => {});
const clearSiteData = vi.fn(async () => {});
vi.mock("@/lib/scrapers/session-store", () => ({ getUnlocked: () => getUnlocked() }));
vi.mock("@/lib/scrapers/session-assist", () => ({
  clearDistributorSession: (...a: unknown[]) => clearDistributorSession(...a),
  clearSiteData: () => clearSiteData(),
  isAssistCandidate: (s?: string | null, r?: string | null) =>
    s === "blocked" || (s === "error" && !!r && /no price found/i.test(r)),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@/lib/scrapers/health", () => ({
  createHealthService: () => ({
    getDistributorHealth: async () => [
      { distributorId: "pbtech-nz", status: "working", lastChecked: "2026-01-01T00:00:00.000Z" },
      { distributorId: "winncom-us", status: "blocked", reason: "blocked by site", lastChecked: "2026-01-01T00:00:00.000Z" },
    ],
  }),
}));

import { SiteSessionsSection } from "@/components/settings/site-sessions-section";

describe("SiteSessionsSection", () => {
  afterEach(() => cleanup());

  it("lists relevant distributors with session hints and clears one", async () => {
    render(<SiteSessionsSection />);
    await waitFor(() => expect(screen.getByText(/PB Tech/)).toBeTruthy());
    // pbtech is unlocked + working -> Active; winncom is blocked -> candidate.
    expect(screen.getByText(/Active/)).toBeTruthy();
    expect(screen.getByText(/Winncom/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear PB Tech"));
    await waitFor(() => expect(clearDistributorSession).toHaveBeenCalledTimes(1));
  });

  it("toggles show-all and clears everything", async () => {
    render(<SiteSessionsSection />);
    await waitFor(() => expect(screen.getByLabelText("Show all distributors")).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Show all distributors"));
    fireEvent.click(screen.getByLabelText("Clear all sessions"));
    expect(clearSiteData).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/site-sessions-section.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite the section**

```tsx
// components/settings/site-sessions-section.tsx
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import { getDistributorById } from "@shared/distributors";
import { PARSERS } from "@/lib/scrapers/registry";
import { createHealthService, type DistributorHealth } from "@/lib/scrapers/health";
import {
  clearDistributorSession,
  clearSiteData,
  isAssistCandidate,
} from "@/lib/scrapers/session-assist";
import { getUnlocked } from "@/lib/scrapers/session-store";
import { SessionAssistModal } from "@/components/session-assist-modal";

const healthService = createHealthService(AsyncStorage);

type Hint = "active" | "expired" | "none";

function hintFor(id: string, unlocked: boolean, status?: string, reason?: string): Hint {
  if (!unlocked) return "none";
  if (status === "working") return "active";
  if (isAssistCandidate(status, reason)) return "expired";
  return "active";
}

export function SiteSessionsSection() {
  const colors = useColors();
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [u, h] = await Promise.all([
      getUnlocked(),
      healthService.getDistributorHealth(),
    ]);
    setUnlocked(u);
    setHealth(h);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = new Map(health.map((h) => [h.distributorId, h]));
  const relevant = PARSERS.filter((p) => {
    if (showAll) return true;
    const h = byId.get(p.id);
    return !!unlocked[p.id] || isAssistCandidate(h?.status, h?.reason);
  });

  async function handleClear(id: string) {
    const parser = PARSERS.find((p) => p.id === id);
    if (!parser) return;
    setBusy(true);
    try {
      await clearDistributorSession(parser);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    setBusy(true);
    try {
      await clearSiteData();
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "700" }}>
        Site sessions
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
        Sign-ins and challenge passes for distributor sites are stored only on
        this device, never synced.
      </Text>

      {relevant.map((p) => {
        const h = byId.get(p.id);
        const hint = hintFor(p.id, !!unlocked[p.id], h?.status, h?.reason);
        const name = getDistributorById(p.id)?.name ?? p.id;
        const hintColor =
          hint === "active" ? colors.success : hint === "expired" ? colors.warning : colors.muted;
        const hintLabel =
          hint === "active" ? "Active" : hint === "expired" ? "Expired — unlock again" : "None";
        return (
          <View
            key={p.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>
                {name}
              </Text>
              <Text style={{ color: hintColor, fontSize: 12 }}>{hintLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Unlock ${name}`}
              onPress={() => setAssistId(p.id)}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, borderRadius: 12, backgroundColor: colors.primary }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Unlock</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Clear ${name}`}
              disabled={busy}
              onPress={() => handleClear(p.id)}
              hitSlop={8}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.error }}
            >
              <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>Clear</Text>
            </Pressable>
          </View>
        );
      })}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show all distributors"
          onPress={() => setShowAll((v) => !v)}
          hitSlop={8}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
            {showAll ? "Show relevant" : "Show all 25"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all sessions"
          disabled={busy}
          onPress={handleClearAll}
          hitSlop={8}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.error, opacity: busy ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
            Clear all sessions
          </Text>
        </Pressable>
      </View>

      {assistId && (
        <SessionAssistModal
          visible
          parser={PARSERS.find((p) => p.id === assistId)!}
          title={getDistributorById(assistId)?.name ?? assistId}
          onClose={() => setAssistId(null)}
          onDone={() => {
            setAssistId(null);
            void load();
          }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm exec vitest run tests/site-sessions-section.test.tsx && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add components/settings/site-sessions-section.tsx tests/site-sessions-section.test.tsx
git commit -m "feat(settings): site sessions manager (per-domain clear + expiry)"
```

---

### Task 7: Full verification + on-device check

**Files:** none (verification)

- [ ] **Step 1: Gate**

Run: `pnpm check && pnpm lint && pnpm verify`
Expected: green.

- [ ] **Step 2: On-device**

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64
```
Install on the emulator; Settings → **Site sessions**: unlock a distributor (it becomes Active), Clear it (hint → None), and Clear all. Confirm no crash.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry (session manager: per-domain clear + expiry; remaining limits: background rendering, per-site coverage) and commit `docs: session manager (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** unlocked set (Task 1), host `clearStorage` (Tasks 2–3), per-domain + global clear (Task 4), Health `markUnlocked` (Task 5), Settings manager with hints + show-all (Task 6), verification/device (Task 7). Background rendering and per-site coverage are explicitly out of scope.
- **Placeholders:** none.
- **Type consistency:** `getUnlocked/markUnlocked/clearUnlocked/clearAllUnlocked`, `WebViewHost.clearStorage(url)`, `STORAGE_CLEARED_SENTINEL`, `buildClearStorageJS()`, `clearDistributorSession(parser)`, `clearSiteData()`, and `isAssistCandidate(status, reason?)` are used consistently across tasks.
