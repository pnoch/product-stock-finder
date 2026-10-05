# On-Device Session Assist ("Unlock this site") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user solve Cloudflare challenges / log into distributor accounts in a visible on-device WebView, then reuse that session (cookies) for automated price fetches.

**Architecture:** The assist WebView and the hidden fetch pool are both non-incognito, so they share Android's system CookieManager; nothing captures or injects cookies. A framework-free `session-assist.ts` provides URL/status helpers; a visible `SessionAssistModal` is launched from the Health dashboard for `blocked`/`no-price` distributors; `HealthService.testDistributor` re-probes one distributor after Done.

**Tech Stack:** Expo SDK 54 / React Native 0.81, `react-native-webview`, `@react-native-cookies/cookies` (clearing only), TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-session-assist-design.md`

---

## File Structure

- Create `lib/scrapers/session-assist.ts` — host/URL/status helpers + `clearSiteData`.
- Create `components/session-assist-modal.tsx` — visible WebView modal.
- Create `components/settings/site-sessions-section.tsx` — Settings explanation + clear.
- Modify `lib/scrapers/health.ts` — add `testDistributor`, extract `probeParser`.
- Modify `app/health.tsx` — unlock action + modal + re-probe.
- Modify `app/(tabs)/settings.tsx` — mount the section.
- Modify `package.json`/`pnpm-lock.yaml` — add the cookie dependency.
- Tests: `tests/scrapers/session-assist.test.ts`, `tests/session-assist-modal.test.tsx`, `tests/health-test-distributor.test.ts`, `tests/session-assist-health-guard.test.ts`, `tests/site-sessions-section.test.tsx`.

---

### Task 1: Add the cookie dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `EXPO_OFFLINE=1 npx expo install @react-native-cookies/cookies`
If expo's `pnpm add` fails on the workspace root, fall back to the SDK-pinned version:
`pnpm add -w -E @react-native-cookies/cookies@<version from expo's bundledNativeModules.json>`

- [ ] **Step 2: Confirm**

Run: `node -e "console.log(require('@react-native-cookies/cookies/package.json').version)"`
Expected: a version string.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(android): add @react-native-cookies/cookies for session clearing"
```

---

### Task 2: Session-assist helpers

**Files:**
- Create: `lib/scrapers/session-assist.ts`
- Test: `tests/scrapers/session-assist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/session-assist.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  distributorHost,
  assistUrl,
  isAssistCandidate,
  clearSiteData,
} from "@/lib/scrapers/session-assist";

const clearAll = vi.fn(async () => {});
vi.mock("@react-native-cookies/cookies", () => ({
  default: { clearAll: () => clearAll() },
}));

const parser = {
  id: "x",
  baseUrl: "https://www.pbtech.co.nz",
  buildSearchUrl: (m: string) => `https://www.pbtech.co.nz/search?sf=${m}`,
} as never;

describe("session-assist helpers", () => {
  it("derives the host and assist URL from the parser", () => {
    expect(distributorHost(parser)).toBe("www.pbtech.co.nz");
    expect(assistUrl(parser)).toBe("https://www.pbtech.co.nz");
  });

  it("offers the assist for blocked and no-price outcomes, not working", () => {
    expect(isAssistCandidate("blocked")).toBe(true);
    expect(isAssistCandidate("error", "no price found")).toBe(true);
    expect(isAssistCandidate("error", "No price found · 12ms")).toBe(true);
    expect(isAssistCandidate("error", "Cloudflare challenge could not be resolved")).toBe(false);
    expect(isAssistCandidate("working")).toBe(false);
    expect(isAssistCandidate(null)).toBe(false);
    expect(isAssistCandidate(undefined, undefined)).toBe(false);
  });
});

describe("clearSiteData", () => {
  beforeEach(() => clearAll.mockClear());
  it("clears all cookies via the cookie manager", async () => {
    await clearSiteData();
    expect(clearAll).toHaveBeenCalledTimes(1);
  });
  it("never throws when the cookie manager is unavailable", async () => {
    clearAll.mockRejectedValueOnce(new Error("no native module"));
    await expect(clearSiteData()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/session-assist.test.ts`
Expected: FAIL — "Cannot find module '@/lib/scrapers/session-assist'".

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/scrapers/session-assist.ts
import type { DistributorParser } from "./types";

export function distributorHost(parser: DistributorParser): string {
  try {
    return new URL(parser.baseUrl).hostname;
  } catch {
    return parser.baseUrl;
  }
}

export function assistUrl(parser: DistributorParser): string {
  return parser.baseUrl;
}

// The unlock action is offered for a blocked distributor, or one that rendered
// but yielded no price (a likely login/consent wall). Other errors are not.
export function isAssistCandidate(
  status?: string | null,
  reason?: string | null,
): boolean {
  if (status === "blocked") return true;
  if (status === "error" && typeof reason === "string" && /no price found/i.test(reason)) {
    return true;
  }
  return false;
}

// Sign out of every distributor site by clearing all WebView cookies. The
// assist modal and the hidden fetch pool are both non-incognito, so the session
// IS the cookie jar. Best-effort — never throws.
export async function clearSiteData(): Promise<void> {
  try {
    const mod = await import("@react-native-cookies/cookies");
    await mod.default.clearAll();
  } catch {
    // Cookie manager unavailable (web / native module missing) — no-op.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/session-assist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/session-assist.ts tests/scrapers/session-assist.test.ts
git commit -m "feat(scrapers): session-assist helpers (host, url, candidate, clear)"
```

---

### Task 3: `HealthService.testDistributor`

**Files:**
- Modify: `lib/scrapers/health.ts`
- Test: `tests/health-test-distributor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/health-test-distributor.test.ts
import { describe, expect, it, vi } from "vitest";
import { createHealthService } from "@/lib/scrapers/health";
import { createMemoryBreakerStore } from "@/lib/scrapers/resilient";

// A fake storage adapter backed by a Map.
function memAdapter() {
  const m = new Map<string, string>();
  return {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  } as never;
}

describe("HealthService.testDistributor", () => {
  it("returns null for an unknown parser id", async () => {
    const svc = createHealthService(memAdapter());
    await expect(svc.testDistributor("nope")).resolves.toBeNull();
  });

  it("records a sample and merges the distributor's health entry", async () => {
    const adapter = memAdapter();
    const svc = createHealthService(adapter);
    // Stub the network so the probe returns a deterministic outcome without
    // hitting a real site: force fetchAndParse via a fetch mock.
    const fetchMock = vi.fn(async () => new Response("<html>nothing</html>", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await svc.testDistributor("server2u-us");
    expect(result).not.toBeNull();
    expect(result!.distributorId).toBe("server2u-us");
    expect(["working", "blocked", "error"]).toContain(result!.status);

    const saved = await svc.getDistributorHealth();
    expect(saved.some((h) => h.distributorId === "server2u-us")).toBe(true);
    const history = await svc.getHealthHistory();
    expect(history["server2u-us"]?.length).toBe(1);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/health-test-distributor.test.ts`
Expected: FAIL — `svc.testDistributor is not a function`.

- [ ] **Step 3: Extract `probeParser` and add `testDistributor`**

In `lib/scrapers/health.ts`, add `testDistributor` to the `HealthService` type:

```ts
  testDistributor(parserId: string): Promise<DistributorHealth | null>;
```

Inside `createHealthService` (before the `return`), add a `probeParser` helper and `testDistributor`, and refactor `testAllDistributorsInner` to use `probeParser`:

```ts
  async function probeParser(
    parser: (typeof PARSERS)[number],
    breakerStore: ReturnType<typeof createStorageBreakerStore>,
  ): Promise<DistributorHealth> {
    const start = Date.now();
    try {
      const model = getProbeModel(parser.id);
      const { outcome } = await fetchAndParse(parser, model, breakerStore);
      const { status, reason } = classifyProbeOutcome(outcome, parser);
      return {
        distributorId: parser.id,
        status,
        reason,
        responseTimeMs: sanitizeResponseTimeMs(Date.now() - start),
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      return {
        distributorId: parser.id,
        status: "error" as HealthStatus,
        reason: error instanceof Error ? error.message : String(error),
        responseTimeMs: sanitizeResponseTimeMs(Date.now() - start),
        lastChecked: new Date().toISOString(),
      };
    }
  }

  async function testDistributor(
    parserId: string,
  ): Promise<DistributorHealth | null> {
    const parser = PARSERS.find((p) => p.id === parserId);
    if (!parser) return null;
    const breakerStore = createStorageBreakerStore(adapter);
    const result = await probeParser(parser, breakerStore);
    const current = await getDistributorHealth();
    const merged = current.filter((h) => h.distributorId !== parserId);
    merged.push(result);
    await saveDistributorHealth(merged);
    await recordSample(
      result.distributorId,
      result.status,
      result.reason,
      result.responseTimeMs,
    );
    return result;
  }
```

Replace the inline probe inside `testAllDistributorsInner`'s `batch.map` with `probeParser(parser, breakerStore)`:

```ts
      const batchResults = await Promise.all(
        batch.map((parser) => probeParser(parser, breakerStore)),
      );
```

Add `testDistributor` to the returned object:

```ts
  return {
    getDistributorHealth,
    saveDistributorHealth,
    testAllDistributors,
    testDistributor,
    getHealthHistory,
    recordSample,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/health-test-distributor.test.ts tests/health.test.ts tests/scrapers/health.test.ts 2>&1 | tail -5`
Expected: PASS (and the existing health tests still pass).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/health-test-distributor.test.ts
git commit -m "feat(health): add testDistributor for single-distributor re-probe"
```

---

### Task 4: Visible assist modal

**Files:**
- Create: `components/session-assist-modal.tsx`
- Test: `tests/session-assist-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/session-assist-modal.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

const wv = vi.hoisted(() => ({ current: null as any }));
vi.mock("react-native-webview", () => ({
  WebView: (props: Record<string, unknown>) => {
    wv.current = props;
    return React.createElement("div");
  },
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown) => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  return {
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA" }),
}));

import { SessionAssistModal } from "@/components/session-assist-modal";
const parser = {
  id: "pbtech-nz",
  baseUrl: "https://www.pbtech.co.nz",
  buildSearchUrl: (m: string) => `https://www.pbtech.co.nz/search?sf=${m}`,
} as never;

describe("SessionAssistModal", () => {
  afterEach(() => cleanup());

  it("renders the distributor site and fires Done/Close", () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    render(
      <SessionAssistModal
        visible
        parser={parser}
        title="PB Tech"
        onDone={onDone}
        onClose={onClose}
      />,
    );
    expect(wv.current.source.uri).toBe("https://www.pbtech.co.nz");
    fireEvent.click(screen.getByLabelText("Done"));
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks non-web navigations", () => {
    render(
      <SessionAssistModal visible parser={parser} title="PB Tech" onDone={() => {}} onClose={() => {}} />,
    );
    const shouldLoad = wv.current.onShouldStartLoadWithRequest;
    expect(shouldLoad({ url: "https://www.pbtech.co.nz/x" })).toBe(true);
    expect(shouldLoad({ url: "intent://scan" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/session-assist-modal.test.tsx`
Expected: FAIL — "Cannot find module '@/components/session-assist-modal'".

- [ ] **Step 3: Write minimal implementation**

```tsx
// components/session-assist-modal.tsx
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { DistributorParser } from "@/lib/scrapers/types";
import { assistUrl } from "@/lib/scrapers/session-assist";
import { useColors } from "@/hooks/use-colors";

interface Props {
  visible: boolean;
  parser: DistributorParser;
  title: string;
  onClose: () => void;
  onDone: () => void;
}

/**
 * A visible WebView at the distributor's own site so the user can solve a
 * Cloudflare challenge or sign in. It shares the system CookieManager with the
 * hidden fetch pool, so the warmed session is reused automatically.
 */
export function SessionAssistModal({ visible, parser, title, onClose, onDone }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
          >
            <Text style={{ color: colors.muted, fontSize: 16 }}>Close</Text>
          </Pressable>
          <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onDone}
            hitSlop={12}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>
              Done
            </Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 12, paddingTop: 8 }}>
          Sign in or complete the check, then tap Done.
        </Text>
        {loading && (
          <View style={{ height: 3, backgroundColor: colors.border }}>
            <View style={{ height: 3, width: "40%", backgroundColor: colors.primary }} />
          </View>
        )}
        <WebView
          source={{ uri: assistUrl(parser) }}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          // Only the distributor's own web pages; block intent://, market://, tel:.
          onShouldStartLoadWithRequest={(r) => /^(https?:|about:)/i.test(r.url)}
        />
      </View>
    </Modal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/session-assist-modal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/session-assist-modal.tsx tests/session-assist-modal.test.tsx
git commit -m "feat(health): visible session-assist modal"
```

---

### Task 5: Wire the unlock action into the Health screen

**Files:**
- Modify: `app/health.tsx`
- Test: `tests/session-assist-health-guard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/session-assist-health-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("health unlock action", () => {
  const src = readFileSync(path.join(process.cwd(), "app/health.tsx"), "utf8");
  it("renders an unlock action for assist candidates and mounts the modal", () => {
    expect(src).toContain("isAssistCandidate(");
    expect(src).toContain("SessionAssistModal");
    expect(src).toContain("testDistributor(");
    expect(src).toContain('accessibilityLabel={`Unlock ${');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/session-assist-health-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add imports, state, handler, action, and modal**

Add imports near the other lib imports in `app/health.tsx`:

```tsx
import { SessionAssistModal } from "@/components/session-assist-modal";
import { isAssistCandidate } from "@/lib/scrapers/session-assist";
import { PARSERS } from "@/lib/scrapers/registry";
```

Add state near the other `useState`s in the component:

```tsx
  const [assistParserId, setAssistParserId] = useState<string | null>(null);
```

Add the re-probe handler after `runTest`:

```tsx
  const handleAssistDone = useCallback(async () => {
    const parserId = assistParserId;
    setAssistParserId(null);
    if (!parserId) return;
    try {
      const result = await healthService.testDistributor(parserId);
      if (!isMountedRef.current || !result) return;
      setHealth((prev) => {
        const next = prev.filter((h) => h.distributorId !== parserId);
        next.push(result);
        return next;
      });
      const history = await healthService.getHealthHistory();
      if (isMountedRef.current) setStats(computeHealthStats(history));
    } catch (e) {
      log.error("[Health] re-probe after assist failed", e);
    }
  }, [assistParserId]);
```

Inside the row (`filtered.map`), after the right column `</View>` and before the closing `</TouchableOpacity>`, add the unlock action:

```tsx
              {isAssistCandidate(h.status, h.reason) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Unlock ${distributor?.name ?? h.distributorId}`}
                  hitSlop={8}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    setAssistParserId(h.distributorId);
                  }}
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                    Unlock
                  </Text>
                </Pressable>
              )}
```

Explicitly import `Pressable` from react-native (add to the existing `react-native` import).

Render the modal just before `</ScreenContainer>`:

```tsx
      {assistParserId && (
        <SessionAssistModal
          visible
          parser={PARSERS.find((p) => p.id === assistParserId)!}
          title={
            getDistributorById(assistParserId)?.name ?? assistParserId
          }
          onClose={() => setAssistParserId(null)}
          onDone={() => void handleAssistDone()}
        />
      )}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm exec vitest run tests/session-assist-health-guard.test.ts && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add app/health.tsx tests/session-assist-health-guard.test.ts
git commit -m "feat(health): unlock action + session assist for blocked distributors"
```

---

### Task 6: Settings "Site sessions" section

**Files:**
- Create: `components/settings/site-sessions-section.tsx`
- Modify: `app/(tabs)/settings.tsx`
- Test: `tests/site-sessions-section.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/site-sessions-section.test.tsx
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown) => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  type P = { children?: React.ReactNode; onPress?: () => void; accessibilityLabel?: string };
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA", error: "#EF4444" }),
}));
const clearSiteData = vi.fn(async () => {});
vi.mock("@/lib/scrapers/session-assist", () => ({ clearSiteData: () => clearSiteData() }));

import { SiteSessionsSection } from "@/components/settings/site-sessions-section";

describe("SiteSessionsSection", () => {
  afterEach(() => cleanup());
  it("explains on-device sessions and clears them", () => {
    render(<SiteSessionsSection />);
    expect(screen.getByText(/stored only on this device/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear site sessions"));
    expect(clearSiteData).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/site-sessions-section.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the section**

```tsx
// components/settings/site-sessions-section.tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { clearSiteData } from "@/lib/scrapers/session-assist";

export function SiteSessionsSection() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClear() {
    setBusy(true);
    try {
      await clearSiteData();
      setDone(true);
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
        this device, never synced. Clearing signs you out of all of them.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear site sessions"
        disabled={busy}
        onPress={handleClear}
        style={{
          marginTop: 10,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.error,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ color: colors.error, fontWeight: "700", fontSize: 13 }}>
          {busy ? "Clearing…" : done ? "Cleared" : "Clear site sessions"}
        </Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Mount it in Settings**

In `app/(tabs)/settings.tsx`, add the import and render it after `<AboutSection onDataCleared={reloadData} />`:

```tsx
import { SiteSessionsSection } from "@/components/settings/site-sessions-section";
```

```tsx
        <AboutSection onDataCleared={reloadData} />
        <SiteSessionsSection />
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm exec vitest run tests/site-sessions-section.test.tsx && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add components/settings/site-sessions-section.tsx "app/(tabs)/settings.tsx" tests/site-sessions-section.test.tsx
git commit -m "feat(settings): site sessions section with clear action"
```

---

### Task 7: Full verification + on-device check

**Files:** none (verification)

- [ ] **Step 1: Lint + full gate**

Run: `pnpm check && pnpm lint && pnpm verify`
Expected: green (root tests + desktop + cargo).

- [ ] **Step 2: On-device check**

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64
```
Install on the emulator, open Health, tap **Unlock** on a blocked distributor, complete/skip, tap **Done**, and confirm the row re-probes. Then Settings → **Clear site sessions** and confirm no crash.

- [ ] **Step 3: Document the phase**

Add a `todo.md` entry summarizing the feature, the cookie-only reuse caveat, and the global-clear limitation; commit `docs: on-device session assist (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** helpers + `clearSiteData` (Task 2), `testDistributor` (Task 3), visible modal (Task 4), Health unlock + re-probe (Task 5), Settings section (Task 6), verification/device (Task 7). The `localStorage` and per-domain-clear limitations are documented in the spec, not implemented (YAGNI).
- **Placeholders:** none.
- **Type consistency:** `isAssistCandidate(status, reason?)`, `assistUrl/distributorHost(parser)`, `clearSiteData()`, `HealthService.testDistributor(parserId)`, and `SessionAssistModal` props (`visible/parser/title/onClose/onDone`) are used consistently across tasks.
