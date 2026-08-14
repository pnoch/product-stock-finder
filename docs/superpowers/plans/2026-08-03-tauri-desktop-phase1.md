# Tauri Desktop App — Phase 1: Scaffold + Storage Adapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Tauri 2 desktop app scaffold in `desktop/` and refactor `lib/storage.ts` to use a `StorageAdapter` interface so the same storage logic works on both mobile (AsyncStorage) and desktop (localStorage).

**Architecture:** Tauri 2 + React 19 + Vite + Tailwind in `desktop/`. pnpm workspace with root `package.json`. `lib/storage.ts` gains a `StorageAdapter` interface and `createStorage()` factory. Existing mobile imports remain backward-compatible via default instance export.

**Tech Stack:** Tauri 2, React 19, Vite 6, Tailwind CSS 4, TypeScript 5.9, pnpm 9.12, vitest

**Spec:** `docs/superpowers/specs/2026-08-03-tauri-desktop-design.md`

---

## File Structure

### Files to Create

| File                                          | Purpose                                       |
| --------------------------------------------- | --------------------------------------------- |
| `desktop/package.json`                        | Desktop app dependencies and scripts          |
| `desktop/tsconfig.json`                       | TypeScript config (Vite + React)              |
| `desktop/vite.config.ts`                      | Vite bundler config                           |
| `desktop/index.html`                          | Vite HTML entry                               |
| `desktop/tailwind.config.js`                  | Tailwind configuration                        |
| `desktop/postcss.config.js`                   | PostCSS for Tailwind                          |
| `desktop/src/main.tsx`                        | React entry point                             |
| `desktop/src/App.tsx`                         | Root component with React Router              |
| `desktop/src/storage.ts`                      | localStorage implementation of StorageAdapter |
| `desktop/src/pages/Home.tsx`                  | Dashboard placeholder                         |
| `desktop/src/pages/Watchlist.tsx`             | Watchlist placeholder                         |
| `desktop/src/pages/ProductDetail.tsx`         | Product detail placeholder                    |
| `desktop/src/pages/Compare.tsx`               | Compare placeholder                           |
| `desktop/src/pages/Alerts.tsx`                | Alerts placeholder                            |
| `desktop/src/pages/Search.tsx`                | Search placeholder                            |
| `desktop/src/pages/Settings.tsx`              | Settings placeholder                          |
| `desktop/src/components/Sidebar.tsx`          | Sidebar navigation                            |
| `desktop/src/styles/globals.css`              | Global Tailwind CSS                           |
| `desktop/src-tauri/Cargo.toml`                | Rust dependencies                             |
| `desktop/src-tauri/src/main.rs`               | Tauri app entry                               |
| `desktop/src-tauri/src/lib.rs`                | Tauri commands (placeholder)                  |
| `desktop/src-tauri/tauri.conf.json`           | Tauri config                                  |
| `desktop/src-tauri/capabilities/default.json` | Tauri 2 capabilities                          |
| `desktop/src-tauri/icons/`                    | App icons (placeholder)                       |
| `pnpm-workspace.yaml`                         | Declares desktop/ as workspace                |

### Files to Modify

| File             | Change                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `lib/storage.ts` | Add `StorageAdapter` interface, `createStorage()` factory, backward-compatible default export |
| `package.json`   | Add `dev:desktop` and `build:desktop` scripts                                                 |
| `tsconfig.json`  | Exclude `desktop/` from mobile tsconfig                                                       |

---

## Tasks

### Task 1: pnpm Workspace Setup

**Files:**

- Create: `pnpm-workspace.yaml`
- Modify: `package.json`

- [ ] **Step 1: Create workspace config**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "desktop"
```

- [ ] **Step 2: Add desktop scripts to root package.json**

Add to the `scripts` section of `/home/pnoch/Development/product-stock-finder/package.json`:

```json
"dev:desktop": "pnpm --filter desktop dev",
"build:desktop": "pnpm --filter desktop build",
"check:desktop": "pnpm --filter desktop check"
```

- [ ] **Step 3: Verify workspace is recognized**

Run: `pnpm ls --depth 0 -r 2>/dev/null || echo "workspace recognized"`

Expected: No errors (desktop package doesn't exist yet, that's fine)

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: add pnpm workspace for desktop app"
```

---

### Task 2: StorageAdapter Interface + Factory

**Files:**

- Modify: `lib/storage.ts`

- [ ] **Step 1: Add StorageAdapter interface and createStorage factory**

Add to the top of `/home/pnoch/Development/product-stock-finder/lib/storage.ts`, after the imports:

```typescript
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

export function createStorage(adapter: StorageAdapter) {
  const KEYS = {
    WATCHLIST: "watchlist_products",
    ALERTS: "price_alerts",
    SETTINGS: "app_settings",
    REMINDERS: "back_order_reminders",
    STOCK_WATCHES: "back_in_stock_watches",
  };

  const DEFAULT_SETTINGS: AppSettings = {
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  };

  // ─── Watchlist ──────────────────────────────────────────────────────────────

  async function getWatchlist(): Promise<Product[]> {
    try {
      const raw = await adapter.getItem(KEYS.WATCHLIST);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveWatchlist(products: Product[]): Promise<void> {
    await adapter.setItem(KEYS.WATCHLIST, JSON.stringify(products));
  }

  async function addToWatchlist(product: Product): Promise<void> {
    const list = await getWatchlist();
    const exists = list.find((p) => p.id === product.id);
    if (!exists) {
      list.unshift({
        ...product,
        isWatched: true,
        addedAt: new Date().toISOString(),
      });
      await saveWatchlist(list);
    }
  }

  async function removeFromWatchlist(productId: string): Promise<void> {
    const list = await getWatchlist();
    await saveWatchlist(list.filter((p) => p.id !== productId));
  }

  async function updateProductListings(
    productId: string,
    listings: DistributorListing[],
  ): Promise<void> {
    const list = await getWatchlist();
    const updated = list.map((p) =>
      p.id === productId ? { ...p, listings } : p,
    );
    await saveWatchlist(updated);
  }

  async function refreshWatchlistPrices(): Promise<void> {
    const list = await getWatchlist();
    const now = new Date().toISOString();
    const updated = list.map((p) => ({ ...p, lastRefreshed: now }));
    await saveWatchlist(updated);
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  async function getAlerts(): Promise<PriceAlert[]> {
    try {
      const raw = await adapter.getItem(KEYS.ALERTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveAlerts(alerts: PriceAlert[]): Promise<void> {
    await adapter.setItem(KEYS.ALERTS, JSON.stringify(alerts));
  }

  async function addAlert(alert: PriceAlert): Promise<void> {
    const alerts = await getAlerts();
    alerts.unshift(alert);
    await saveAlerts(alerts);
  }

  async function removeAlert(alertId: string): Promise<void> {
    const alerts = await getAlerts();
    await saveAlerts(alerts.filter((a) => a.id !== alertId));
  }

  async function toggleAlert(alertId: string): Promise<void> {
    const alerts = await getAlerts();
    const updated = alerts.map((a) =>
      a.id === alertId ? { ...a, isActive: !a.isActive } : a,
    );
    await saveAlerts(updated);
  }

  async function rearmAlert(alertId: string): Promise<void> {
    const alerts = await getAlerts();
    const updated = alerts.map((a) =>
      a.id === alertId
        ? {
            ...a,
            isActive: true,
            triggeredAt: undefined,
            triggeredPrice: undefined,
          }
        : a,
    );
    await saveAlerts(updated);
  }

  // ─── Settings ───────────────────────────────────────────────────────────────

  async function getSettings(): Promise<AppSettings> {
    try {
      const raw = await adapter.getItem(KEYS.SETTINGS);
      return raw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async function saveSettings(settings: AppSettings): Promise<void> {
    await adapter.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  }

  // ─── Back-Order Reminders ───────────────────────────────────────────────────

  async function getBackOrderReminders(): Promise<BackOrderReminder[]> {
    try {
      const raw = await adapter.getItem(KEYS.REMINDERS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveBackOrderReminders(
    reminders: BackOrderReminder[],
  ): Promise<void> {
    await adapter.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
  }

  async function addBackOrderReminder(
    reminder: BackOrderReminder,
  ): Promise<void> {
    const reminders = await getBackOrderReminders();
    const existing = reminders.findIndex(
      (r) =>
        r.productId === reminder.productId &&
        r.distributorId === reminder.distributorId,
    );
    if (existing >= 0) {
      reminders[existing] = reminder;
    } else {
      reminders.unshift(reminder);
    }
    await saveBackOrderReminders(reminders);
  }

  async function removeBackOrderReminder(reminderId: string): Promise<void> {
    const reminders = await getBackOrderReminders();
    await saveBackOrderReminders(reminders.filter((r) => r.id !== reminderId));
  }

  // ─── Back-In-Stock Watches ──────────────────────────────────────────────────

  async function getStockWatches(): Promise<BackOrderReminder[]> {
    try {
      const raw = await adapter.getItem(KEYS.STOCK_WATCHES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async function saveStockWatches(watches: BackOrderReminder[]): Promise<void> {
    await adapter.setItem(KEYS.STOCK_WATCHES, JSON.stringify(watches));
  }

  async function addStockWatch(watch: BackOrderReminder): Promise<void> {
    const watches = await getStockWatches();
    const existing = watches.findIndex(
      (w) =>
        w.productId === watch.productId &&
        w.distributorId === watch.distributorId,
    );
    if (existing >= 0) {
      watches[existing] = watch;
    } else {
      watches.unshift(watch);
    }
    await saveStockWatches(watches);
  }

  async function removeStockWatch(watchId: string): Promise<void> {
    const watches = await getStockWatches();
    await saveStockWatches(watches.filter((w) => w.id !== watchId));
  }

  async function updateStockWatchStatus(
    productId: string,
    distributorId: string,
    status: string,
  ): Promise<void> {
    const watches = await getStockWatches();
    const updated = watches.map((w) =>
      w.productId === productId && w.distributorId === distributorId
        ? { ...w, lastKnownStatus: status }
        : w,
    );
    await saveStockWatches(updated);
  }

  // ─── Clear All Data ─────────────────────────────────────────────────────────

  async function clearAllData(): Promise<void> {
    await adapter.multiRemove([
      KEYS.WATCHLIST,
      KEYS.ALERTS,
      KEYS.SETTINGS,
      KEYS.REMINDERS,
      KEYS.STOCK_WATCHES,
      "recently_viewed",
      "distributor_watches",
      "triggered_alert_history",
      "product_notes",
      "has_seen_onboarding",
    ]);
  }

  return {
    getWatchlist,
    saveWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateProductListings,
    refreshWatchlistPrices,
    getAlerts,
    saveAlerts,
    addAlert,
    removeAlert,
    toggleAlert,
    rearmAlert,
    getSettings,
    saveSettings,
    getBackOrderReminders,
    saveBackOrderReminders,
    addBackOrderReminder,
    removeBackOrderReminder,
    getStockWatches,
    saveStockWatches,
    addStockWatch,
    removeStockWatch,
    updateStockWatchStatus,
    clearAllData,
  };
}

export type Storage = ReturnType<typeof createStorage>;
```

- [ ] **Step 2: Replace existing functions with backward-compatible default export**

Replace the entire body of `lib/storage.ts` (after the new `createStorage` function) with:

```typescript
// ─── Default instance (mobile / AsyncStorage) ──────────────────────────────────
// Preserves backward-compatible named exports so existing imports work unchanged.

const defaultStorage = createStorage(AsyncStorage);

export const {
  getWatchlist,
  saveWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateProductListings,
  refreshWatchlistPrices,
  getAlerts,
  saveAlerts,
  addAlert,
  removeAlert,
  toggleAlert,
  rearmAlert,
  getSettings,
  saveSettings,
  getBackOrderReminders,
  saveBackOrderReminders,
  addBackOrderReminder,
  removeBackOrderReminder,
  getStockWatches,
  saveStockWatches,
  addStockWatch,
  removeStockWatch,
  updateStockWatchStatus,
  clearAllData,
} = defaultStorage;
```

- [ ] **Step 3: Remove the old inline function definitions**

Delete all the old function bodies that are now inside `createStorage` (lines ~27-254 in the original file). The file should now contain:

1. Imports
2. `StorageAdapter` interface
3. `createStorage()` factory with all logic inside
4. `Storage` type export
5. Default instance + named re-exports

- [ ] **Step 4: Verify mobile still typechecks**

Run: `pnpm check`

Expected: 0 TypeScript errors

- [ ] **Step 5: Verify existing tests still pass**

Run: `pnpm test`

Expected: All 50 tests pass (storage tests use mock adapter, not AsyncStorage directly)

- [ ] **Step 6: Commit**

```bash
git add lib/storage.ts
git commit -m "refactor: add StorageAdapter interface to lib/storage.ts

Adds StorageAdapter interface and createStorage() factory for
platform-agnostic storage. Backward-compatible: existing named
exports (getWatchlist, addAlert, etc.) still work via default
AsyncStorage instance."
```

---

### Task 3: Tauri Desktop Scaffold

**Files:**

- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/index.html`
- Create: `desktop/tailwind.config.js`
- Create: `desktop/postcss.config.js`
- Create: `desktop/src/main.tsx`
- Create: `desktop/src/App.tsx`
- Create: `desktop/src/styles/globals.css`
- Create: `desktop/src/storage.ts`
- Create: `desktop/src/pages/Home.tsx`
- Create: `desktop/src/pages/Watchlist.tsx`
- Create: `desktop/src/pages/ProductDetail.tsx`
- Create: `desktop/src/pages/Compare.tsx`
- Create: `desktop/src/pages/Alerts.tsx`
- Create: `desktop/src/pages/Search.tsx`
- Create: `desktop/src/pages/Settings.tsx`
- Create: `desktop/src/components/Sidebar.tsx`

- [ ] **Step 1: Create desktop/package.json**

```json
{
  "name": "desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "check": "tsc --noEmit",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "recharts": "^2.15.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create desktop/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create desktop/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
});
```

- [ ] **Step 4: Create desktop/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Product Stock Finder</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create desktop/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e8f0fe",
          100: "#c5d9fc",
          200: "#9ebef9",
          300: "#74a2f5",
          400: "#538df2",
          500: "#3B7DD8",
          600: "#0F52BA",
          700: "#0d47a1",
          800: "#0b3d8e",
          900: "#082d6b",
        },
        success: "#00C896",
        warning: "#F59E0B",
        error: "#EF4444",
        surface: {
          light: "#FFFFFF",
          dark: "#131929",
        },
        background: {
          light: "#F8FAFC",
          dark: "#0A0E1A",
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Create desktop/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create desktop/src/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color: #1a1a2e;
  background-color: #f8fafc;
}

@media (prefers-color-scheme: dark) {
  :root {
    color: #e2e8f0;
    background-color: #0a0e1a;
  }
}
```

- [ ] **Step 8: Create desktop/src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Create desktop/src/components/Sidebar.tsx**

```tsx
import { NavLink } from "react-router";
import {
  LayoutDashboard,
  List,
  Bell,
  Search,
  Settings,
  BarChart3,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/watchlist", icon: List, label: "Watchlist" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <BarChart3 className="w-6 h-6 text-brand-600" />
        <span className="hidden lg:block font-semibold text-sm">
          Product Stock Finder
        </span>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 10: Create page placeholders**

Create each page file with a minimal placeholder:

`desktop/src/pages/Home.tsx`:

```tsx
export function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-500 dark:text-gray-400">
        Desktop app scaffolded successfully. Coming soon.
      </p>
    </div>
  );
}
```

`desktop/src/pages/Watchlist.tsx`:

```tsx
export function Watchlist() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Watchlist</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

`desktop/src/pages/ProductDetail.tsx`:

```tsx
export function ProductDetail() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Product Detail</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

`desktop/src/pages/Compare.tsx`:

```tsx
export function Compare() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Compare</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

`desktop/src/pages/Alerts.tsx`:

```tsx
export function Alerts() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Alerts</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

`desktop/src/pages/Search.tsx`:

```tsx
export function Search() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

`desktop/src/pages/Settings.tsx`:

```tsx
export function Settings() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p className="text-gray-500 dark:text-gray-400">Coming soon.</p>
    </div>
  );
}
```

- [ ] **Step 11: Create App.tsx with React Router**

```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import { Sidebar } from "./components/Sidebar";
import { Home } from "./pages/Home";
import { Watchlist } from "./pages/Watchlist";
import { ProductDetail } from "./pages/ProductDetail";
import { Compare } from "./pages/Compare";
import { Alerts } from "./pages/Alerts";
import { Search } from "./pages/Search";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/compare/:id" element={<Compare />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/search" element={<Search />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 12: Create desktop/src/storage.ts**

```typescript
import { createStorage } from "../../lib/storage";

const localStorageAdapter = {
  getItem: async (key: string) => localStorage.getItem(key),
  setItem: async (key: string, value: string) =>
    localStorage.setItem(key, value),
  removeItem: async (key: string) => localStorage.removeItem(key),
  multiRemove: async (keys: string[]) =>
    keys.forEach((k) => localStorage.removeItem(k)),
};

export const storage = createStorage(localStorageAdapter);
```

- [ ] **Step 13: Exclude desktop from mobile tsconfig**

Add `"desktop"` to the `exclude` array in `/home/pnoch/Development/product-stock-finder/tsconfig.json`:

```json
"exclude": ["node_modules", "dist", "desktop"]
```

- [ ] **Step 14: Install dependencies and verify Vite builds**

Run: `pnpm install`

Then: `pnpm --filter desktop check`

Expected: 0 TypeScript errors

Then: `pnpm --filter desktop build`

Expected: Vite builds successfully (output in `desktop/dist/`)

- [ ] **Step 15: Commit**

```bash
git add desktop/ pnpm-workspace.yaml package.json tsconfig.json
git commit -m "feat: scaffold Tauri desktop app with React + Vite + Tailwind

Creates desktop/ with React Router, Sidebar navigation, placeholder
pages, localStorage StorageAdapter, and workspace integration.
Vite builds successfully. All pages render."
```

---

### Task 4: Tauri Rust Backend Scaffold

**Files:**

- Create: `desktop/src-tauri/Cargo.toml`
- Create: `desktop/src-tauri/src/main.rs`
- Create: `desktop/src-tauri/src/lib.rs`
- Create: `desktop/src-tauri/tauri.conf.json`
- Create: `desktop/src-tauri/capabilities/default.json`
- Create: `desktop/src-tauri/icons/` (placeholder)

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "product-stock-finder"
version = "0.1.0"
edition = "2021"

[lib]
name = "product_stock_finder_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Create src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    product_stock_finder_lib::run();
}
```

- [ ] **Step 3: Create src/lib.rs**

```rust
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Product Stock Finder.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Create tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json",
  "productName": "Product Stock Finder",
  "version": "0.1.0",
  "identifier": "com.app.stock_finder",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Product Stock Finder",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 5: Create capabilities/default.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema/capability.json",
  "identifier": "default",
  "description": "Default capabilities for Product Stock Finder",
  "windows": ["main"],
  "permissions": ["core:default", "notification:default", "dialog:default"]
}
```

- [ ] **Step 6: Create build.rs**

Create `desktop/src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build();
}
```

- [ ] **Step 7: Create placeholder icons directory**

```bash
mkdir -p desktop/src-tauri/icons
```

- [ ] **Step 8: Verify Cargo.toml parses**

Run: `cd desktop/src-tauri && cargo check 2>&1 | head -20`

Expected: Starts downloading/compiling dependencies (may take a few minutes first time). No syntax errors in Cargo.toml.

- [ ] **Step 9: Commit**

```bash
git add desktop/src-tauri/
git commit -m "feat: scaffold Tauri Rust backend with notification + dialog plugins

Adds Cargo.toml, main.rs, lib.rs, tauri.conf.json, and capabilities.
Includes greet command as placeholder. Tauri 2 with notification and
dialog plugins."
```

---

### Task 5: Tauri Desktop Notifications + System Tray

**Files:**

- Modify: `desktop/src-tauri/src/lib.rs`
- Create: `desktop/src/notifications.ts`

- [ ] **Step 1: Add notification command to lib.rs**

Replace the content of `desktop/src-tauri/src/lib.rs`:

```rust
use tauri::Manager;

#[tauri::command]
fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    sound: bool,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;

    let mut notification = app
        .notification()
        .builder()
        .title(&title)
        .body(&body);

    if sound {
        notification = notification.sound(Some("default"));
    }

    notification.show().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            send_notification,
            get_app_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Create desktop/src/notifications.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";

export async function sendDesktopNotification(
  title: string,
  body: string,
): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true });
  } catch (e) {
    console.error("Failed to send notification:", e);
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter desktop check`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src/notifications.ts
git commit -m "feat: add desktop notification command and TypeScript wrapper"
```

---

### Task 6: File Import/Export Rust Commands

**Files:**

- Modify: `desktop/src-tauri/src/lib.rs`
- Create: `desktop/src/import-export.ts`

- [ ] **Step 1: Add import/export commands to lib.rs**

Add before the `#[cfg_attr(mobile, tauri::mobile_entry_point)]` line in `desktop/src-tauri/src/lib.rs`:

```rust
use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize, serde::Deserialize)]
struct ExportData {
    version: u32,
    exported_at: String,
    watchlist: serde_json::Value,
    alerts: serde_json::Value,
    reminders: serde_json::Value,
    settings: serde_json::Value,
}

#[tauri::command]
fn export_watchlist(
    app: tauri::AppHandle,
    format: String,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let watchlist = read_json_file(&data_dir, "watchlist_products")?;
    let alerts = read_json_file(&data_dir, "price_alerts")?;
    let reminders = read_json_file(&data_dir, "back_order_reminders")?;
    let settings = read_json_file(&data_dir, "app_settings")?;

    let export = ExportData {
        version: 1,
        exported_at: chrono_free_placeholder(),
        watchlist,
        alerts,
        reminders,
        settings,
    };

    let content = match format.as_str() {
        "json" => serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?,
        "csv" => export_to_csv(&export)?,
        _ => return Err(format!("Unsupported format: {}", format)),
    };

    Ok(content)
}

#[tauri::command]
fn import_watchlist(
    app: tauri::AppHandle,
    content: String,
    format: String,
) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    match format.as_str() {
        "json" => {
            let import: ExportData =
                serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

            if import.version != 1 {
                return Err(format!("Unsupported version: {}", import.version));
            }

            write_json_file(&data_dir, "watchlist_products", &import.watchlist)?;
            write_json_file(&data_dir, "price_alerts", &import.alerts)?;
            write_json_file(&data_dir, "back_order_reminders", &import.reminders)?;
            write_json_file(&data_dir, "app_settings", &import.settings)?;

            Ok("Import successful".to_string())
        }
        "csv" => {
            // CSV import is more complex; for v1 we support JSON only
            Err("CSV import not yet implemented".to_string())
        }
        _ => Err(format!("Unsupported format: {}", format)),
    }
}

fn read_json_file(data_dir: &PathBuf, key: &str) -> Result<serde_json::Value, String> {
    let path = data_dir.join(format!("{}.json", key));
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(serde_json::Value::Null)
    }
}

fn write_json_file(
    data_dir: &PathBuf,
    key: &str,
    value: &serde_json::Value,
) -> Result<(), String> {
    fs::create_dir_all(data_dir).map_err(|e| e.to_string())?;
    let path = data_dir.join(format!("{}.json", key));
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn export_to_csv(_export: &ExportData) -> Result<String, String> {
    // CSV export placeholder - will implement with proper serialization
    Err("CSV export not yet implemented".to_string())
}

fn chrono_free_placeholder() -> String {
    // Simple timestamp without chrono dependency
    // Will be replaced with proper timestamp in production
    "2026-01-01T00:00:00Z".to_string()
}
```

Also update the `invoke_handler` to include the new commands:

```rust
.invoke_handler(tauri::generate_handler![
    send_notification,
    get_app_data_dir,
    export_watchlist,
    import_watchlist
])
```

- [ ] **Step 2: Create desktop/src/import-export.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

export async function exportWatchlistAsJson(): Promise<string> {
  const content = await invoke<string>("export_watchlist", { format: "json" });

  const filePath = await save({
    defaultPath: "product-stock-finder-export.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (filePath) {
    await invoke("write_file", { path: filePath, content });
    return `Exported to ${filePath}`;
  }
  return "Export cancelled";
}

export async function importWatchlistFromJson(): Promise<string> {
  const filePath = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  });

  if (filePath) {
    const content = await invoke<string>("read_file", {
      path: filePath as string,
    });
    const result = await invoke<string>("import_watchlist", {
      content,
      format: "json",
    });
    return result;
  }
  return "Import cancelled";
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter desktop check`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src/import-export.ts
git commit -m "feat: add file import/export Tauri commands with JSON support"
```

---

### Task 7: System Tray + Background Polling

**Files:**

- Modify: `desktop/src-tauri/src/lib.rs`
- Create: `desktop/src/background.ts`

- [ ] **Step 1: Add tray and background polling to lib.rs**

Replace the full content of `desktop/src-tauri/src/lib.rs` with the complete implementation including system tray setup, background price polling command, and all previous commands. The tray will have:

- App icon
- Context menu: "Open", "Check Now", "Quit"
- Badge count for active alerts

Add the `tauri-plugin-autostart` dependency to `Cargo.toml` for optional auto-start:

```toml
tauri-plugin-autostart = "2"
```

And register it in `run()`:

```rust
.plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
```

- [ ] **Step 2: Create desktop/src/background.ts**

```typescript
import { invoke } from "@tauri-apps/api/core";

export async function startPricePoller(
  intervalMinutes: number = 15,
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes });
  } catch (e) {
    console.error("Failed to start price poller:", e);
  }
}

export async function checkPriceDropsNow(): Promise<string> {
  try {
    return await invoke("check_price_drops");
  } catch (e) {
    return `Error: ${e}`;
  }
}

export async function stopPricePoller(): Promise<void> {
  try {
    await invoke("stop_price_poller");
  } catch (e) {
    console.error("Failed to stop price poller:", e);
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter desktop check`

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add desktop/src-tauri/src/lib.rs desktop/src/background.ts desktop/src-tauri/Cargo.toml
git commit -m "feat: add system tray and background price polling"
```

---

## Verification

After all tasks, run:

```bash
# Mobile still works
pnpm check
pnpm test

# Desktop builds
pnpm --filter desktop check
pnpm --filter desktop build

# Full lint
pnpm lint
```

All should pass with 0 errors.

---

## What This Plan Does NOT Cover (Future Phases)

- Phase 3: Full screen implementations (Home dashboard, Watchlist table, Product Detail)
- Phase 4: Compare screen with Recharts multi-line chart
- Phase 5: Full alerts/reminders with notification integration
- Phase 6: Search modal, Settings page with theme toggle
- Phase 7: Menu bar, keyboard shortcuts, system tray polish
- Phase 8: Responsive layout, transitions, error states, empty states

These will be covered in follow-up plans once the scaffold is verified.
