# Distributor Health Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Distributor Health Dashboard screen to both mobile (Expo) and desktop (Tauri) apps, showing scraper status per distributor with a live "Test All" capability.

**Architecture:** A shared `lib/scrapers/health.ts` module provides classification, live testing, and persistence via the `StorageAdapter` pattern. Both mobile (`app/health.tsx`) and desktop (`desktop/src/pages/Health.tsx`) screens consume this shared module. Status persists to AsyncStorage/localStorage under the `distributor_health` key.

**Tech Stack:** TypeScript, Expo Router (mobile), React Router (desktop), AsyncStorage/localStorage, existing scraper registry + `fetchWithParser`.

---

## File Structure

### New Files

- `lib/scrapers/health.ts` — shared health module (types, classifyResult, testAllDistributors, createHealthService)
- `app/health.tsx` — mobile screen
- `desktop/src/pages/Health.tsx` — desktop screen
- `tests/scrapers/health.test.ts` — unit tests for classification + persistence
- `desktop/tests/health.test.tsx` — component tests for desktop screen

### Modified Files

- `lib/background-price-check.ts` — update health status during scrape
- `desktop/src/App.tsx` — add Health route
- `desktop/src/components/` — shared UI components if needed

---

## Task 1: Create Shared Health Module

**Files:**

- Create: `lib/scrapers/health.ts`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { classifyResult } from "@/lib/scrapers/health";

describe("classifyResult", () => {
  it("returns working when result has a price", () => {
    const result = {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "x",
    };
    expect(classifyResult("<html></html>", result)).toBe("working");
  });

  it("returns blocked when HTML contains 403 Forbidden", () => {
    expect(classifyResult("403 Forbidden", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Access Denied", () => {
    expect(classifyResult("Access Denied", null)).toBe("blocked");
  });

  it("returns blocked when HTML contains Cloudflare challenge", () => {
    expect(classifyResult("cf-browser-verification", null)).toBe("blocked");
  });

  it("returns error when result is null and no block detected", () => {
    expect(classifyResult("<html>no products</html>", null)).toBe("error");
  });

  it("returns error when an error is thrown", () => {
    expect(classifyResult("", null, new Error("connection refused"))).toBe(
      "error",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/scrapers/health.test.ts`
Expected: FAIL with "Cannot find module '@/lib/scrapers/health'"

- [ ] **Step 3: Write minimal implementation**

```typescript
import { DistributorParser, ScrapeResult } from "./types";
import { PARSERS } from "./registry";
import { fetchWithParser } from "./utils";
import { StorageAdapter } from "@/lib/storage";

export type HealthStatus = "working" | "blocked" | "error";

export interface DistributorHealth {
  distributorId: string;
  status: HealthStatus;
  reason?: string;
  responseTimeMs?: number;
  lastChecked: string;
}

const HEALTH_KEY = "distributor_health";

export function classifyResult(
  html: string,
  result: ScrapeResult | null,
  error?: unknown,
): HealthStatus {
  if (error) return "error";
  if (
    html.includes("403 Forbidden") ||
    html.includes("Access Denied") ||
    html.includes("cf-browser-verification") ||
    html.includes("Checking your browser")
  ) {
    return "blocked";
  }
  if (result && result.price > 0) return "working";
  return "error";
}

export function createHealthService(adapter: StorageAdapter) {
  async function getDistributorHealth(): Promise<DistributorHealth[]> {
    try {
      const raw = await adapter.getItem(HEALTH_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveDistributorHealth(
    health: DistributorHealth[],
  ): Promise<void> {
    try {
      await adapter.setItem(HEALTH_KEY, JSON.stringify(health));
    } catch {
      // Ignore save errors
    }
  }

  async function testAllDistributors(
    onProgress?: (current: number, total: number) => void,
  ): Promise<DistributorHealth[]> {
    const results: DistributorHealth[] = [];
    const CONCURRENCY = 3;
    const total = PARSERS.length;

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = PARSERS.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (parser) => {
          const start = Date.now();
          try {
            const url = parser.buildSearchUrl("CRS326");
            const html = await fetchWithParser(parser, url);
            const result = parser.parsePrice(html);
            const status = classifyResult(html, result);
            return {
              distributorId: parser.id,
              status,
              reason: status === "error" ? "no price found" : undefined,
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            } as DistributorHealth;
          } catch (error) {
            return {
              distributorId: parser.id,
              status: "error" as HealthStatus,
              reason: error instanceof Error ? error.message : String(error),
              responseTimeMs: Date.now() - start,
              lastChecked: new Date().toISOString(),
            } as DistributorHealth;
          }
        }),
      );
      results.push(...batchResults);
      onProgress?.(Math.min(i + CONCURRENCY, total), total);
    }

    await saveDistributorHealth(results);
    return results;
  }

  return { getDistributorHealth, saveDistributorHealth, testAllDistributors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/scrapers/health.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "feat: add shared distributor health module with classification and live testing"
```

---

## Task 2: Add Persistence Tests

**Files:**

- Modify: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Add persistence tests**

```typescript
import { createHealthService } from "@/lib/scrapers/health";

function createMockAdapter() {
  const store = new Map<string, string>();
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  };
}

describe("createHealthService", () => {
  it("saves and loads health", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    const health = [
      {
        distributorId: "server2u-my",
        status: "working",
        lastChecked: new Date().toISOString(),
      },
    ];
    await service.saveDistributorHealth(health);
    const loaded = await service.getDistributorHealth();
    expect(loaded).toEqual(health);
  });

  it("returns empty array when nothing stored", async () => {
    const adapter = createMockAdapter();
    const service = createHealthService(adapter);
    expect(await service.getDistributorHealth()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/scrapers/health.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 3: Commit**

```bash
git add tests/scrapers/health.test.ts
git commit -m "test: add health service persistence tests"
```

---

## Task 3: Create Mobile Health Screen

**Files:**

- Create: `app/health.tsx`

- [ ] **Step 1: Create the mobile screen**

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { createHealthService, DistributorHealth } from "@/lib/scrapers/health";
import { getDistributorById } from "@/lib/distributors";

const healthService = createHealthService(AsyncStorage);

const STATUS_COLORS: Record<string, string> = {
  working: "#00C896",
  blocked: "#F59E0B",
  error: "#EF4444",
};

export default function HealthScreen() {
  const colors = useColors();
  const router = useRouter();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<"all" | "working" | "blocked" | "error">(
    "all",
  );
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadHealth = useCallback(async () => {
    const data = await healthService.getDistributorHealth();
    setHealth(data);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    const results = await healthService.testAllDistributors(
      (current, total) => {
        setProgress(Math.round((current / total) * 100));
      },
    );
    setHealth(results);
    setTesting(false);
  }, []);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter(
    (h) => filter === "all" || h.status === filter,
  );

  return (
    <ScreenContainer>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: colors.primary, fontSize: 16 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text
          style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}
        >
          Distributor Health
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        {(["all", "working", "blocked", "error"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              marginRight: 8,
              backgroundColor: filter === f ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: filter === f ? "#fff" : colors.foreground,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {f === "all" ? `All (${health.length})` : `${f} (${counts[f]})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={runTest}
        disabled={testing}
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        }}
      >
        {testing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Test All Distributors
          </Text>
        )}
      </TouchableOpacity>

      {testing && (
        <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 6,
                width: `${progress}%`,
                backgroundColor: colors.primary,
              }}
            />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            {progress}%
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          if (!distributor) return null;
          return (
            <View
              key={h.distributorId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: STATUS_COLORS[h.status],
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.foreground,
                    fontWeight: "500",
                    fontSize: 14,
                  }}
                >
                  {distributor.countryFlag} {distributor.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
                </Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {h.lastChecked
                  ? new Date(h.lastChecked).toLocaleTimeString()
                  : "Never"}
              </Text>
            </View>
          );
        })}
        {filtered.length === 0 && (
          <Text
            style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}
          >
            No distributor health data. Tap "Test All Distributors" to run a
            check.
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Commit**

```bash
git add app/health.tsx
git commit -m "feat: add mobile distributor health screen"
```

---

## Task 4: Create Desktop Health Screen

**Files:**

- Create: `desktop/src/pages/Health.tsx`
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Create the desktop screen**

```tsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  createHealthService,
  DistributorHealth,
} from "../../../lib/scrapers/health";
import { getDistributorById } from "../../../lib/distributors";
import { storage } from "../storage";

const healthService = createHealthService(storage);

const STATUS_COLORS: Record<string, string> = {
  working: "#00C896",
  blocked: "#F59E0B",
  error: "#EF4444",
};

type Filter = "all" | "working" | "blocked" | "error";

export function Health() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<DistributorHealth[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadHealth = useCallback(async () => {
    const data = await healthService.getDistributorHealth();
    setHealth(data);
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const runTest = useCallback(async () => {
    setTesting(true);
    setProgress(0);
    const results = await healthService.testAllDistributors(
      (current, total) => {
        setProgress(Math.round((current / total) * 100));
      },
    );
    setHealth(results);
    setTesting(false);
  }, []);

  const counts = {
    working: health.filter((h) => h.status === "working").length,
    blocked: health.filter((h) => h.status === "blocked").length,
    error: health.filter((h) => h.status === "error").length,
  };

  const filtered = health.filter(
    (h) => filter === "all" || h.status === filter,
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center mb-4">
        <button
          onClick={() => navigate("/settings")}
          className="text-blue-600 mr-3"
        >
          ‹ Back
        </button>
        <h1 className="text-2xl font-bold">Distributor Health</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(["all", "working", "blocked", "error"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-800 border-gray-300"
            }`}
          >
            {f === "all" ? `All (${health.length})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      <button
        onClick={runTest}
        disabled={testing}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold mb-4 disabled:opacity-50"
      >
        {testing ? "Testing..." : "Test All Distributors"}
      </button>

      {testing && (
        <div className="mb-4">
          <div className="h-1.5 rounded bg-gray-200 overflow-hidden">
            <div
              className="h-1.5 bg-blue-600"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{progress}%</p>
        </div>
      )}

      <div>
        {filtered.map((h) => {
          const distributor = getDistributorById(h.distributorId);
          if (!distributor) return null;
          return (
            <div
              key={h.distributorId}
              className="flex items-center py-3 border-b border-gray-200"
            >
              <span
                className="w-2.5 h-2.5 rounded-full mr-3"
                style={{ backgroundColor: STATUS_COLORS[h.status] }}
              />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {distributor.countryFlag} {distributor.name}
                </p>
                <p className="text-xs text-gray-500">
                  {h.reason || h.status}
                  {h.responseTimeMs ? ` · ${h.responseTimeMs}ms` : ""}
                </p>
              </div>
              <span className="text-xs text-gray-400">
                {h.lastChecked
                  ? new Date(h.lastChecked).toLocaleTimeString()
                  : "Never"}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            No distributor health data. Tap "Test All Distributors" to run a
            check.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the route to App.tsx**

```tsx
import { Health } from "./pages/Health";
// ...
<Route path="/health" element={<Health />} />;
```

- [ ] **Step 3: Run typecheck to verify no errors**

Run: `pnpm --filter desktop check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Health.tsx desktop/src/App.tsx
git commit -m "feat: add desktop distributor health screen"
```

---

## Task 5: Add Desktop Health Component Tests

**Files:**

- Create: `desktop/tests/health.test.tsx`

- [ ] **Step 1: Create the test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Health } from "../src/pages/Health";

vi.mock("../src/storage", () => ({
  storage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the title", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Distributor Health")).toBeDefined();
  });

  it("shows empty state when no data", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/No distributor health data/)).toBeDefined();
  });

  it("renders Test All button", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Test All Distributors")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter desktop test tests/health.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/health.test.tsx
git commit -m "test: add desktop health screen component tests"
```

---

## Task 6: Wire Health Updates into Background Scrape

**Files:**

- Modify: `lib/background-price-check.ts`

- [ ] **Step 1: Add health update to the scrape loop**

In both the background task and `checkPriceDropsNow`, after each parser scrape, update the health status. Add a helper that records the result:

```typescript
import { createHealthService, DistributorHealth } from "./scrapers/health";
import AsyncStorage from "@react-native-async-storage/async-storage";

const healthService = createHealthService(AsyncStorage);

async function updateHealthForScrape(
  parserId: string,
  status: "working" | "blocked" | "error",
  reason?: string,
) {
  const current = await healthService.getDistributorHealth();
  const existing = current.find((h) => h.distributorId === parserId);
  const entry: DistributorHealth = {
    distributorId: parserId,
    status,
    reason,
    lastChecked: new Date().toISOString(),
  };
  const updated = existing
    ? current.map((h) => (h.distributorId === parserId ? entry : h))
    : [...current, entry];
  await healthService.saveDistributorHealth(updated);
}
```

Then in the scrape loop, after `fetchWithParser` + `parsePrice`:

```typescript
const html = await fetchWithParser(parser, url);
const result = parser.parsePrice(html);
if (result) {
  await updateHealthForScrape(parser.id, "working");
  // ... existing result handling
} else {
  await updateHealthForScrape(parser.id, "error", "no price found");
  // ... existing else handling
}
```

And in the catch block:

```typescript
} catch (error) {
  await updateHealthForScrape(
    parser.id,
    "error",
    error instanceof Error ? error.message : String(error),
  );
  updatedListings.push(listing);
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

Run: `pnpm check`
Expected: PASS (0 TypeScript errors)

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `pnpm test tests/price-check.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/background-price-check.ts
git commit -m "feat: update distributor health during background scrape"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run all checks**

```bash
pnpm check
pnpm lint
pnpm test
pnpm --filter desktop check
pnpm --filter desktop test
```

Expected: All pass

- [ ] **Step 2: Update todo.md**

Add Phase 16 entry for the distributor health dashboard.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: add Phase 16 distributor health dashboard to todo.md"
```
