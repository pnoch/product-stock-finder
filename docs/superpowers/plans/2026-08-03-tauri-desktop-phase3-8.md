# Tauri Desktop App — Phase 3-8: Full Screen Implementations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all desktop app screens with full feature parity to the mobile app, plus desktop-specific polish.

**Architecture:** Each screen is a React component using the shared `storage` object from `desktop/src/storage.ts` and pure-TS utilities from `lib/`. Uses React Router for navigation, Tailwind CSS for styling, Recharts for charts, Lucide React for icons.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, Recharts, Lucide React, TypeScript 5.9

**Spec:** `docs/superpowers/specs/2026-08-03-tauri-desktop-design.md`

---

## File Structure

### Files to Create
| File | Purpose |
|------|---------|
| `desktop/src/hooks/use-storage.ts` | React hook wrapping storage calls with loading/error states |
| `desktop/src/hooks/use-theme.ts` | Dark/light theme toggle hook |
| `desktop/src/components/StockBadge.tsx` | Reusable stock status badge |
| `desktop/src/components/PriceSparkline.tsx` | Mini SVG price chart |
| `desktop/src/components/ProductCard.tsx` | Watchlist product card |
| `desktop/src/components/DistributorRow.tsx` | Distributor listing row |
| `desktop/src/components/EmptyState.tsx` | Empty state placeholder |
| `desktop/src/components/LoadingSpinner.tsx` | Loading indicator |
| `desktop/src/components/Modal.tsx` | Reusable modal dialog |
| `desktop/src/components/SearchModal.tsx` | Search overlay (Cmd+K) |
| `desktop/src/components/MultiLineChart.tsx` | Recharts multi-line chart for compare |
| `desktop/src/components/TimeRangeChips.tsx` | 1W/1M/3M/All filter chips |
| `desktop/src/lib/notifications.ts` | Desktop notification helpers (wraps Tauri invoke) |

### Files to Modify
| File | Change |
|------|--------|
| `desktop/src/pages/Home.tsx` | Full dashboard implementation |
| `desktop/src/pages/Watchlist.tsx` | Full watchlist with sort/filter |
| `desktop/src/pages/ProductDetail.tsx` | Full product detail with distributors |
| `desktop/src/pages/Compare.tsx` | Multi-distributor comparison chart |
| `desktop/src/pages/Alerts.tsx` | Alerts + reminders tabs |
| `desktop/src/pages/Search.tsx` | Catalog search |
| `desktop/src/pages/Settings.tsx` | Settings page |
| `desktop/src/App.tsx` | Add keyboard shortcut handler |

---

## Tasks

### Task 1: Shared Hooks + Components

**Files:**
- Create: `desktop/src/hooks/use-storage.ts`
- Create: `desktop/src/hooks/use-theme.ts`
- Create: `desktop/src/components/StockBadge.tsx`
- Create: `desktop/src/components/EmptyState.tsx`
- Create: `desktop/src/components/LoadingSpinner.tsx`
- Create: `desktop/src/components/Modal.tsx`
- Create: `desktop/src/lib/notifications.ts`

- [ ] **Step 1: Create use-storage hook**

```typescript
// desktop/src/hooks/use-storage.ts
import { useState, useEffect, useCallback } from "react";
import { storage } from "../storage";

export function useWatchlist() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getWatchlist();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { products, loading, refresh };
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getAlerts();
    setAlerts(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { alerts, loading, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await storage.getSettings();
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...partial };
    await storage.saveSettings(updated);
    setSettings(updated);
  }, [settings]);

  return { settings, loading, refresh, update };
}
```

- [ ] **Step 2: Create use-theme hook**

```typescript
// desktop/src/hooks/use-theme.ts
import { useState, useEffect } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const toggle = () => setTheme(t => t === "light" ? "dark" : "light");

  return { theme, toggle, isDark: theme === "dark" };
}
```

- [ ] **Step 3: Create StockBadge component**

```tsx
// desktop/src/components/StockBadge.tsx
import { StockStatus } from "../../lib/types";

const config: Record<StockStatus, { bg: string; text: string; dot: string; label: string }> = {
  in_stock: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", label: "In Stock" },
  back_order: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "bg-amber-500", label: "Back Order" },
  out_of_stock: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", label: "Out of Stock" },
  unknown: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400", label: "Unknown" },
};

export function StockBadge({ status, expectedDate }: { status: StockStatus; expectedDate?: string }) {
  const c = config[status] ?? config.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}{expectedDate ? ` · ${expectedDate}` : ""}
    </span>
  );
}
```

- [ ] **Step 4: Create EmptyState, LoadingSpinner, Modal**

```tsx
// desktop/src/components/EmptyState.tsx
export function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-gray-400 dark:text-gray-500 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
    </div>
  );
}
```

```tsx
// desktop/src/components/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
```

```tsx
// desktop/src/components/Modal.tsx
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create notifications helper**

```typescript
// desktop/src/lib/notifications.ts
import { invoke } from "@tauri-apps/api/core";

export async function sendNotification(title: string, body: string): Promise<void> {
  try {
    await invoke("send_notification", { title, body, sound: true });
  } catch (e) {
    console.error("Notification failed:", e);
  }
}
```

- [ ] **Step 6: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 7: Commit**

```bash
git add desktop/src/hooks/ desktop/src/components/StockBadge.tsx desktop/src/components/EmptyState.tsx desktop/src/components/LoadingSpinner.tsx desktop/src/components/Modal.tsx desktop/src/lib/notifications.ts
git commit -m "feat: add shared hooks, components, and notification helpers"
```

---

### Task 2: Home Dashboard

**Files:**
- Modify: `desktop/src/pages/Home.tsx`

- [ ] **Step 1: Implement Home dashboard**

Replace `desktop/src/pages/Home.tsx` with a dashboard showing:
- Stats cards: total tracked, in-stock count, alerts active, reminders pending
- Recent activity list (last-refreshed products)
- Quick-add button linking to /search

The component should use `useWatchlist()` and `useAlerts()` hooks to fetch data on mount.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Home.tsx
git commit -m "feat: implement Home dashboard with stats and recent activity"
```

---

### Task 3: Watchlist Screen

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Implement Watchlist**

Replace `desktop/src/pages/Watchlist.tsx` with a full watchlist screen:
- Table/grid view with columns: Product, Distributor Count, Best Price, Stock Status, Trend, Last Updated
- Sort by: Name, Price, Trend, Last Updated
- Filter by: All, In Stock, Back Order, Out of Stock
- Click row navigates to `/product/:id`
- Empty state when no products
- Refresh button

Use `useWatchlist()` hook, `formatPrice`/`getBestPrice` from `lib/currency.ts`, `StockBadge` component.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "feat: implement Watchlist with sort, filter, and product navigation"
```

---

### Task 4: Product Detail Screen

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Implement ProductDetail**

Replace `desktop/src/pages/ProductDetail.tsx` with full product detail:
- Product header (name, model, brand, category)
- Best distributor card with price, stock status, Buy Now link
- Distributor table with price, currency, stock status, trend
- Action buttons: Set Alert, Remind Me, Watch for Restock, Compare
- Price history chart modal (simple SVG sparkline)
- Uses `useParams()` from react-router to get product ID
- Fetches product from watchlist via storage

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat: implement Product Detail with distributor list and actions"
```

---

### Task 5: Compare Screen

**Files:**
- Create: `desktop/src/components/MultiLineChart.tsx`
- Create: `desktop/src/components/TimeRangeChips.tsx`
- Modify: `desktop/src/pages/Compare.tsx`

- [ ] **Step 1: Create MultiLineChart component**

```tsx
// desktop/src/components/MultiLineChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { PricePoint } from "../../lib/types";

interface Props {
  data: { date: string; [distributor: string]: string | number }[];
  distributors: string[];
  colors: string[];
}

export function MultiLineChart({ data, distributors, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {distributors.map((d, i) => (
          <Line key={d} type="monotone" dataKey={d} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create TimeRangeChips**

```tsx
// desktop/src/components/TimeRangeChips.tsx
const ranges = [
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "all", label: "All" },
];

export function TimeRangeChips({ selected, onSelect }: { selected: string; onSelect: (r: string) => void }) {
  return (
    <div className="flex gap-1">
      {ranges.map(r => (
        <button key={r.key} onClick={() => onSelect(r.key)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${selected === r.key ? "bg-brand-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement Compare page**

Replace `desktop/src/pages/Compare.tsx` with:
- Fetch product from watchlist by ID (useParams)
- Group priceHistory by distributor
- Filter by time range
- MultiLineChart with distributor lines
- Cheapest region card
- Sort by trend/name

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 5: Commit**

```bash
git add desktop/src/components/MultiLineChart.tsx desktop/src/components/TimeRangeChips.tsx desktop/src/pages/Compare.tsx
git commit -m "feat: implement Compare screen with Recharts multi-line chart"
```

---

### Task 6: Alerts Screen

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx`

- [ ] **Step 1: Implement Alerts**

Replace `desktop/src/pages/Alerts.tsx` with two tabs:
- **Alerts tab:** Price alerts list with toggle, delete, rearm. Show triggered alerts with history.
- **Reminders tab:** Date reminders + stock watches with reschedule.

Use `useAlerts()` hook, `storage.getBackOrderReminders()`, `storage.getStockWatches()`.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "feat: implement Alerts screen with price alerts and reminders tabs"
```

---

### Task 7: Search Screen

**Files:**
- Modify: `desktop/src/pages/Search.tsx`
- Create: `desktop/src/components/SearchModal.tsx`

- [ ] **Step 1: Create SearchModal**

```tsx
// desktop/src/components/SearchModal.tsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Search, Check, Plus } from "lucide-react";
import { PRODUCT_CATALOG } from "../../../lib/catalog";
import { storage } from "../storage";
import { Modal } from "./Modal";

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
      storage.getWatchlist().then(products => setTrackedIds(new Set(products.map(p => p.id))));
    }
  }, [open]);

  const results = query.length > 0
    ? PRODUCT_CATALOG.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.modelNumber.toLowerCase().includes(query.toLowerCase()) ||
        p.brand.toLowerCase().includes(query.toLowerCase())
      )
    : PRODUCT_CATALOG;

  const handleAdd = async (product: typeof PRODUCT_CATALOG[0]) => {
    await storage.addToWatchlist({ ...product, addedAt: new Date().toISOString(), isWatched: true, listings: [] });
    setTrackedIds(prev => new Set([...prev, product.id]));
  };

  return (
    <Modal open={open} onClose={onClose} title="Search Products">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search by name, model, or brand..." />
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {results.map(product => {
          const isTracked = trackedIds.has(product.id);
          return (
            <div key={product.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div>
                <div className="font-medium text-sm">{product.name}</div>
                <div className="text-xs text-gray-500">{product.brand} · {product.category}</div>
              </div>
              {isTracked ? (
                <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><Check className="w-4 h-4" /> Tracked</span>
              ) : (
                <button onClick={() => handleAdd(product)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700">
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Update Search page**

Replace `desktop/src/pages/Search.tsx` to render the SearchModal as always-open on this route, or integrate with the modal.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx
git commit -m "feat: implement Search with catalog lookup and add-to-watchlist"
```

---

### Task 8: Settings Screen

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Implement Settings**

Replace `desktop/src/pages/Settings.tsx` with:
- Theme toggle (light/dark/auto)
- Display currency selector (all 12 currencies from EXCHANGE_RATES)
- Check interval (manual/hourly/daily)
- Notification toggles
- File import/export buttons (using `import-export.ts`)
- Clear all data button with confirmation

Use `useSettings()` hook.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "feat: implement Settings with theme, currency, import/export"
```

---

### Task 9: Keyboard Shortcuts + Menu Bar

**Files:**
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Add keyboard shortcut handler**

Update `App.tsx` to add a global keyboard shortcut handler:
- Cmd/Ctrl+K: Open search modal
- Cmd/Ctrl+E: Export watchlist
- Cmd/Ctrl+,: Open settings
- Cmd/Ctrl+Shift+T: Toggle theme
- Escape: Close modal

Add state for `searchModalOpen` and pass it down or use context.

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 3: Commit**

```bash
git add desktop/src/App.tsx
git commit -m "feat: add keyboard shortcuts for search, export, settings, theme"
```

---

### Task 10: Responsive Layout + Polish

**Files:**
- Modify: `desktop/src/components/Sidebar.tsx`
- Modify: `desktop/src/styles/globals.css`

- [ ] **Step 1: Improve responsive layout**

Update Sidebar to collapse on narrow viewports. Add smooth transitions. Ensure all pages look good at 800px-1920px widths.

- [ ] **Step 2: Add loading and error states to all pages**

Ensure every page that fetches data shows LoadingSpinner while loading and EmptyState when empty.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter desktop check`

- [ ] **Step 4: Commit**

```bash
git add desktop/src/components/Sidebar.tsx desktop/src/styles/globals.css
git commit -m "feat: improve responsive layout and add loading/empty states"
```

---

## Verification

After all tasks, run:

```bash
pnpm check           # Mobile: 0 TS errors
pnpm --filter desktop check  # Desktop: 0 TS errors
pnpm test            # All 50 tests pass
pnpm lint            # 0 errors
```

## What This Plan Covers

- Phase 3: Home dashboard, Watchlist, Product Detail ✅
- Phase 4: Compare with Recharts ✅
- Phase 5: Alerts + Reminders ✅
- Phase 6: Search, Settings ✅
- Phase 7: Keyboard shortcuts ✅
- Phase 8: Responsive polish ✅
