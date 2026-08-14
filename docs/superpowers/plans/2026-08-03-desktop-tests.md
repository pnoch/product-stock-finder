# Desktop Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add vitest + React Testing Library tests for desktop hooks, components, and pages.

**Architecture:** Desktop tests live in `desktop/tests/`. Uses vitest for unit tests, @testing-library/react for component tests, and a localStorage mock for storage hooks. Tests mirror the mobile app's test patterns.

**Tech Stack:** vitest, @testing-library/react, @testing-library/jest-dom, jsdom

---

## File Structure

### Files to Create

| File                                | Purpose                                                 |
| ----------------------------------- | ------------------------------------------------------- |
| `desktop/vitest.config.ts`          | Vitest configuration                                    |
| `desktop/tests/setup.ts`            | Test setup (jsdom, mocks)                               |
| `desktop/tests/storage.test.ts`     | Storage adapter tests (localStorage)                    |
| `desktop/tests/hooks.test.ts`       | React hook tests (useWatchlist, useAlerts, useSettings) |
| `desktop/tests/components.test.tsx` | Component tests (StockBadge, Modal, EmptyState, etc.)   |
| `desktop/tests/pages.test.tsx`      | Page tests (Home, Watchlist, Settings)                  |

### Files to Modify

| File                   | Change                                |
| ---------------------- | ------------------------------------- |
| `desktop/package.json` | Add test dependencies and test script |

---

## Tasks

### Task 1: Test Setup

**Files:**

- Create: `desktop/vitest.config.ts`
- Create: `desktop/tests/setup.ts`
- Modify: `desktop/package.json`

- [ ] **Step 1: Add test dependencies**

Run in `desktop/`:

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add test script to desktop/package.json**

Add to scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
// desktop/vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
});
```

- [ ] **Step 4: Create tests/setup.ts**

```typescript
// desktop/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Verify vitest runs**

Run: `cd desktop && pnpm test`

Expected: No test files found (0 tests) — vitest runs successfully

- [ ] **Step 6: Commit**

```bash
git add desktop/vitest.config.ts desktop/tests/setup.ts desktop/package.json
git commit -m "chore: add vitest and testing library setup for desktop"
```

---

### Task 2: Storage Adapter Tests

**Files:**

- Create: `desktop/tests/storage.test.ts`

- [ ] **Step 1: Create storage tests**

```typescript
// desktop/tests/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createStorage } from "../../lib/storage";

// In-memory localStorage mock
const store = new Map<string, string>();
const localStorageAdapter = {
  getItem: async (key: string) => store.get(key) ?? null,
  setItem: async (key: string, value: string) => store.set(key, value),
  removeItem: async (key: string) => store.delete(key),
  multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
};

const storage = createStorage(localStorageAdapter);

beforeEach(() => {
  store.clear();
});

describe("StorageAdapter", () => {
  it("should get empty watchlist by default", async () => {
    const result = await storage.getWatchlist();
    expect(result).toEqual([]);
  });

  it("should add and retrieve products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("test-1");
  });

  it("should not add duplicate products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.addToWatchlist(product);
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(1);
  });

  it("should remove products", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.removeFromWatchlist("test-1");
    const list = await storage.getWatchlist();
    expect(list).toHaveLength(0);
  });

  it("should get empty alerts by default", async () => {
    const result = await storage.getAlerts();
    expect(result).toEqual([]);
  });

  it("should add and retrieve alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await storage.addAlert(alert);
    const alerts = await storage.getAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe("alert-1");
  });

  it("should toggle alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await storage.addAlert(alert);
    await storage.toggleAlert("alert-1");
    const alerts = await storage.getAlerts();
    expect(alerts[0].isActive).toBe(false);
  });

  it("should rearm triggered alerts", async () => {
    const alert = {
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: false,
      createdAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
      triggeredPrice: 90,
    };
    await storage.addAlert(alert);
    await storage.rearmAlert("alert-1");
    const alerts = await storage.getAlerts();
    expect(alerts[0].isActive).toBe(true);
    expect(alerts[0].triggeredAt).toBeUndefined();
  });

  it("should get default settings", async () => {
    const settings = await storage.getSettings();
    expect(settings.theme).toBe("auto");
    expect(settings.displayCurrency).toBe("USD");
  });

  it("should save and retrieve settings", async () => {
    const settings = await storage.getSettings();
    settings.displayCurrency = "EUR";
    await storage.saveSettings(settings);
    const loaded = await storage.getSettings();
    expect(loaded.displayCurrency).toBe("EUR");
  });

  it("should clear all data", async () => {
    const product = {
      id: "test-1",
      name: "Test Product",
      modelNumber: "TP-1",
      brand: "Test",
      category: "Test",
      description: "A test product",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    };
    await storage.addToWatchlist(product);
    await storage.addAlert({
      id: "alert-1",
      productId: "test-1",
      targetPrice: 100,
      currency: "USD",
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await storage.clearAllData();
    const list = await storage.getWatchlist();
    const alerts = await storage.getAlerts();
    expect(list).toEqual([]);
    expect(alerts).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd desktop && pnpm test`

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/storage.test.ts
git commit -m "test: add storage adapter tests for localStorage"
```

---

### Task 3: Component Tests

**Files:**

- Create: `desktop/tests/components.test.tsx`

- [ ] **Step 1: Create component tests**

```tsx
// desktop/tests/components.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StockBadge } from "../src/components/StockBadge";
import { EmptyState } from "../src/components/EmptyState";
import { LoadingSpinner } from "../src/components/LoadingSpinner";
import { TimeRangeChips } from "../src/components/TimeRangeChips";

describe("StockBadge", () => {
  it("renders In Stock status", () => {
    render(<StockBadge status="in_stock" />);
    expect(screen.getByText("In Stock")).toBeInTheDocument();
  });

  it("renders Back Order status", () => {
    render(<StockBadge status="back_order" />);
    expect(screen.getByText("Back Order")).toBeInTheDocument();
  });

  it("renders Out of Stock status", () => {
    render(<StockBadge status="out_of_stock" />);
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });

  it("renders Unknown status", () => {
    render(<StockBadge status="unknown" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders expected date when provided", () => {
    render(<StockBadge status="back_order" expectedDate="2026-01-15" />);
    expect(screen.getByText(/2026-01-15/)).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState icon={null} title="No items" description="Add something" />,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Add something")).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders spinner", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("TimeRangeChips", () => {
  it("renders all time range options", () => {
    render(<TimeRangeChips selected="1m" onSelect={() => {}} />);
    expect(screen.getByText("1W")).toBeInTheDocument();
    expect(screen.getByText("1M")).toBeInTheDocument();
    expect(screen.getByText("3M")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    let selected = "1m";
    const { user } = renderWithUser(
      <TimeRangeChips
        selected={selected}
        onSelect={(r) => {
          selected = r;
        }}
      />,
    );
    await user.click(screen.getByText("3M"));
    expect(selected).toBe("3M");
  });
});

// Helper to render with user event
import { userEvent } from "@testing-library/user-event";
function renderWithUser(ui: React.ReactElement) {
  const user = userEvent.setup();
  return { user, ...render(ui) };
}
```

- [ ] **Step 2: Run tests**

Run: `cd desktop && pnpm test`

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/components.test.tsx
git commit -m "test: add component tests for StockBadge, EmptyState, TimeRangeChips"
```

---

### Task 4: Page Tests

**Files:**

- Create: `desktop/tests/pages.test.tsx`

- [ ] **Step 1: Create page tests**

```tsx
// desktop/tests/pages.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Home } from "../src/pages/Home";
import { Settings } from "../src/pages/Settings";

// Mock storage module
const mockStorage = {
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
};

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

function renderWithRouter(ui: React.ReactElement, route = "/") {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
}

describe("Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dashboard title", async () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows stat cards", async () => {
    renderWithRouter(<Home />);
    expect(screen.getByText("Total Tracked")).toBeInTheDocument();
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByText("Alerts Active")).toBeInTheDocument();
    expect(screen.getByText("Reminders")).toBeInTheDocument();
  });
});

describe("Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings title", async () => {
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("shows theme section", async () => {
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
  });

  it("shows currency section", async () => {
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Display Currency")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd desktop && pnpm test`

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add desktop/tests/pages.test.tsx
git commit -m "test: add page tests for Home and Settings"
```

---

## Verification

After all tasks, run:

```bash
cd desktop && pnpm test
```

All tests should pass.
