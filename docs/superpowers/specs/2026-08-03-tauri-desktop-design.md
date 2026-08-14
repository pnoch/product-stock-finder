# Product Stock Finder — Tauri Desktop App Design Spec

## Overview

A standalone desktop application for Product Stock Finder, built with Tauri 2 + React + Vite + NativeWind. Shares core business logic (`lib/`) with the existing Expo mobile app via a storage adapter pattern. Adds desktop-specific features: system tray with background price polling, native file import/export, keyboard shortcuts, and a desktop-optimized layout.

## Goals

- Full feature parity with the mobile app (watchlist, alerts, compare, search, settings)
- Native desktop experience (system tray, menus, keyboard shortcuts)
- Shared `lib/` codebase (no duplication)
- Desktop-specific: background price polling, file import/export
- Consistent visual identity with the mobile app

## Non-Goals (v1)

- Backend integration (server/, drizzle/ remain unused)
- Multi-window support
- Plugin system
- Auto-update (can add later via `tauri-plugin-updater`)

---

## Architecture

### Directory Layout

```
product-stock-finder/
├── app/                    # Expo mobile (unchanged)
├── lib/                    # Shared logic
│   ├── types.ts            # Pure TS — shared as-is
│   ├── currency.ts         # Pure TS — shared as-is
│   ├── catalog.ts          # Pure TS — shared as-is
│   ├── distributors.ts     # Pure TS — shared as-is
│   ├── sample-data.ts      # Pure TS — shared as-is
│   ├── storage.ts          # MODIFIED: StorageAdapter interface + mobile impl
│   ├── notifications.ts    # Mobile-only (expo-notifications) — NOT shared
│   └── background-price-check.ts  # Mobile-only — NOT shared
├── desktop/                # Tauri app (NEW)
│   ├── src/                # React frontend
│   │   ├── main.tsx        # Entry point
│   │   ├── App.tsx         # Root component with router
│   │   ├── storage.ts      # localStorage implementation of StorageAdapter
│   │   ├── notifications.ts # Desktop notifications (Tauri plugin)
│   │   ├── background.ts   # Desktop background polling (Tauri command)
│   │   ├── tray.ts         # System tray setup and updates
│   │   ├── import-export.ts # File import/export via Tauri commands
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Watchlist.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Compare.tsx
│   │   │   ├── Alerts.tsx
│   │   │   ├── Search.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── PriceSparkline.tsx
│   │   │   ├── MultiLineChart.tsx
│   │   │   ├── StockBadge.tsx
│   │   │   └── ...
│   │   └── hooks/
│   │       ├── use-storage.ts
│   │       ├── use-alert-badge.ts
│   │       └── use-colors.ts
│   ├── src-tauri/          # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs     # Tauri app setup, tray, menu, IPC commands
│   │   │   └── lib.rs      # Command handlers (poll, import, export, notify)
│   │   ├── Cargo.toml
│   │   ├── tauri.conf.json
│   │   ├── capabilities/   # Tauri 2 capability declarations
│   │   │   └── default.json
│   │   └── icons/          # App icons
│   ├── index.html          # Vite HTML entry
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── tsconfig.json
├── package.json            # Root (pnpm workspaces)
└── pnpm-workspace.yaml     # NEW: declares desktop/ as workspace
```

### Shared Code via StorageAdapter

The main challenge is that `lib/storage.ts` uses `@react-native-async-storage/async-storage`, which isn't available in Tauri's webview. The solution: abstract storage behind an interface.

#### StorageAdapter Interface (`lib/storage.ts`)

```typescript
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
}

// Factory function that creates all CRUD operations with a given adapter
export function createStorage(adapter: StorageAdapter) {
  const KEYS = {
    WATCHLIST: "watchlist_products",
    ALERTS: "price_alerts" /* ... */,
  };

  return {
    getWatchlist: async (): Promise<Product[]> => {
      /* same logic, uses adapter */
    },
    saveWatchlist: async (products: Product[]) => {
      /* ... */
    },
    addToWatchlist: async (product: Product) => {
      /* ... */
    },
    removeFromWatchlist: async (productId: string) => {
      /* ... */
    },
    updateProductListings: async (
      productId: string,
      listings: DistributorListing[],
    ) => {
      /* ... */
    },
    refreshWatchlistPrices: async () => {
      /* ... */
    },
    getAlerts: async (): Promise<PriceAlert[]> => {
      /* ... */
    },
    saveAlerts: async (alerts: PriceAlert[]) => {
      /* ... */
    },
    addAlert: async (alert: PriceAlert) => {
      /* ... */
    },
    removeAlert: async (alertId: string) => {
      /* ... */
    },
    toggleAlert: async (alertId: string) => {
      /* ... */
    },
    rearmAlert: async (alertId: string) => {
      /* ... */
    },
    getSettings: async (): Promise<AppSettings> => {
      /* ... */
    },
    saveSettings: async (settings: AppSettings) => {
      /* ... */
    },
    getBackOrderReminders: async (): Promise<BackOrderReminder[]> => {
      /* ... */
    },
    addBackOrderReminder: async (reminder: BackOrderReminder) => {
      /* ... */
    },
    removeBackOrderReminder: async (reminderId: string) => {
      /* ... */
    },
    getStockWatches: async (): Promise<BackOrderReminder[]> => {
      /* ... */
    },
    addStockWatch: async (watch: BackOrderReminder) => {
      /* ... */
    },
    removeStockWatch: async (watchId: string) => {
      /* ... */
    },
    updateStockWatchStatus: async (
      productId: string,
      distributorId: string,
      status: string,
    ) => {
      /* ... */
    },
    clearAllData: async () => {
      /* ... */
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;
```

#### Mobile Implementation (existing code, adapted)

```typescript
// In app/_layout.tsx or a mobile storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStorage } from "@/lib/storage";
export const storage = createStorage(AsyncStorage);
```

#### Desktop Implementation (`desktop/src/storage.ts`)

```typescript
import { createStorage } from "../../lib/storage";

// localStorage as a StorageAdapter (works in Tauri's webview)
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

#### Migration: Existing Mobile Code

The existing mobile code imports individual functions directly from `lib/storage.ts` (e.g., `getWatchlist()`, `addAlert()`). These currently close over a module-level `AsyncStorage` reference. To support the adapter pattern, we refactor to:

1. Export a `createStorage(adapter)` factory that returns all CRUD functions
2. Create a default instance for mobile (backward-compatible: `export const { getWatchlist, ... } = createStorage(AsyncStorage)`)
3. Desktop creates its own instance with `localStorageAdapter`

This means existing mobile imports (`import { getWatchlist } from "@/lib/storage"`) continue to work unchanged. The desktop app creates its own `storage` object and passes it to components/hooks.

---

## Desktop-Specific Features

### 1. System Tray + Background Price Polling

**Rust backend (`src-tauri/src/lib.rs`):**

- Uses `tauri-plugin-notification` for native desktop notifications
- Implements a Tauri command `start_price_poller` that:
  - Reads alerts from storage via Tauri's `app_data_dir` (JSON file)
  - Reads watchlist listings
  - Compares best in-stock price (converted to alert currency) against target
  - If price dropped: fires desktop notification, marks alert as triggered
  - Runs on a configurable interval (default 15 minutes, matching mobile)
- System tray icon with:
  - Badge count showing active alerts
  - Context menu: "Open", "Check Now", "Quit"
  - Double-click to open/focus window

**Frontend integration (`desktop/src/tray.ts`):**

- On app start: sends `start_price_poller` command to Rust backend
- On app focus: sends `check_now` command for immediate foreground check
- Receives `alert-triggered` events from Rust backend to update UI badge

### 2. File Import/Export

**Export (`desktop/src-tauri/src/lib.rs`):**

- `export_watchlist(format: "json" | "csv")` command
  - Reads all data from storage (watchlist, alerts, reminders, settings)
  - For JSON: serializes complete state
  - For CSV: flattens listings into tabular format (product, distributor, price, currency, status, URL)
  - Opens native save dialog via `tauri-plugin-dialog`
  - Writes to chosen file path

**Import (`desktop/src-tauri/src/lib.rs`):**

- `import_watchlist()` command
  - Opens native open dialog
  - Reads file, detects format (JSON or CSV)
  - Validates structure against `Product[]` / listing schema
  - Merges into existing watchlist (deduplicates by product ID)
  - Returns count of imported/updated products
  - Frontend shows result notification

**Data format (JSON export):**

```json
{
  "version": 1,
  "exportedAt": "2026-08-03T12:00:00Z",
  "watchlist": [
    /* Product[] */
  ],
  "alerts": [
    /* PriceAlert[] */
  ],
  "reminders": [
    /* BackOrderReminder[] */
  ],
  "settings": {
    /* AppSettings */
  }
}
```

**Data format (CSV export):**

```csv
product_id,product_name,distributor_id,distributor_name,price,currency,stock_status,url,last_checked
mikrotik-crs804-4ddq-hrm,MikroTik CRS804,server2u-my,Server2U,5568,MYR,in_stock,https://...,2026-08-03T12:00:00Z
```

**CSV import rules:**

- Header row required (must match export format)
- `product_id` required; unknown product IDs skipped with warning
- `price` must be numeric; invalid prices skipped
- `stock_status` must be one of: `in_stock`, `back_order`, `out_of_stock`, `unknown`
- Duplicate (product_id, distributor_id) pairs update existing rows
- Missing optional columns (e.g., `url`) default to empty string
- BOM (UTF-8 with BOM) is handled gracefully

### 3. Desktop Notifications

**Rust backend (`src-tauri/src/lib.rs`):**

- Uses `tauri-plugin-notification` for native OS notifications
- Command: `send_notification(title: String, body: String, sound: bool)`
- Called by the price poller when alerts trigger
- Called by the frontend for confirmation notifications (alert set, reminder set, etc.)

**Frontend (`desktop/src/notifications.ts`):**

```typescript
import { invoke } from "@tauri-apps/api/core";

export async function sendNotification(title: string, body: string) {
  await invoke("send_notification", { title, body, sound: true });
}
```

### 4. Menu Bar

**Rust setup (`src-tauri/src/main.rs`):**

```
File
├── Import Watchlist...    Cmd+I
├── Export Watchlist...    Cmd+E
├── ──────────────
├── Settings              Cmd+,
└── Quit                  Cmd+Q

View
├── Toggle Theme          Cmd+Shift+T
├── ──────────────
├── Zoom In               Cmd+=
├── Zoom Out              Cmd+-
└── Reset Zoom            Cmd+0

Help
├── Keyboard Shortcuts    Cmd+/
└── About
```

---

## Desktop UI Design

### Layout

Desktop uses a sidebar + main content layout (not tab-based like mobile):

```
┌──────────────────────────────────────────────────┐
│ ┌──────┐ ┌──────────────────────────────────────┐ │
│ │      │ │  Header (page title + actions)        │ │
│ │ Side │ ├──────────────────────────────────────┤ │
│ │ bar  │ │                                      │ │
│ │      │ │  Main Content Area                    │ │
│ │ 🏠   │ │                                      │ │
│ │ 📋   │ │  (watchlist table, product detail,   │ │
│ │ 🔔   │ │   compare chart, alerts list, etc.)  │ │
│ │ ⚙️   │ │                                      │ │
│ │      │ │                                      │ │
│ └──────┘ └──────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- **Sidebar**: Fixed-width (60px collapsed, 220px expanded), navigation icons with labels
- **Main area**: Fluid width, scrolls vertically
- **Responsive**: On narrow windows (<800px), sidebar collapses to icons only

### Screen Implementations

**Home (Dashboard)**

- Stats cards: total tracked, in-stock count, alerts active, reminders pending
- Recent activity list (last-checked products)
- Quick-add button

**Watchlist**

- Table/grid view with columns: Product, Distributor Count, Best Price, Stock Status, Trend, Last Updated
- Sort by: Name, Price, Trend, Last Updated
- Filter by: All, In Stock, Back Order, Out of Stock
- Click row → Product Detail (opens in same view or side panel)

**Product Detail**

- Product header with name, model, brand
- Best distributor card with sparkline and Buy Now
- Distributor table with price, currency, stock status, trend
- Action buttons: Set Alert, Remind Me, Watch for Restock, Compare
- Price history chart modal

**Compare**

- Multi-line chart with distributor selector
- Time range chips: 1W, 1M, 3M, All
- Sort by: Trend, Price, Name
- Cheapest region card
- Cross-distributor alert CTA

**Alerts**

- Two tabs: Alerts (price alerts + triggered history) and Reminders (date reminders + stock watches)
- All existing logic from mobile: toggle, delete, rearm, reschedule

**Search**

- Modal overlay (Cmd+K trigger)
- Search catalog, show results with add/checkmark button
- Already-tracked products show green checkmark (disabled)

**Settings**

- Theme toggle (light/dark/auto)
- Display currency selector (all 12 currencies)
- Check interval
- Notification toggles
- File import/export buttons
- Clear all data

---

## Tech Stack

| Layer           | Tech                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| Desktop runtime | Tauri 2                                                                           |
| Frontend        | React 19, Vite, TypeScript                                                        |
| Styling         | Tailwind CSS + NativeWind (for cross-platform classnames)                         |
| Routing         | React Router v7 (file-based or manual)                                            |
| State           | React hooks + shared lib/ storage                                                 |
| Charts          | Recharts (mature React charting library, better for desktop than hand-rolled SVG) |
| Icons           | Lucide React (clean, consistent icon set)                                         |
| Rust            | Tauri 2 API, serde, tauri-plugin-notification, tauri-plugin-dialog                |
| Package manager | pnpm (workspace)                                                                  |

### Why Recharts instead of hand-rolled SVG?

The mobile app uses hand-rolled SVG polylines because React Native's SVG ecosystem is limited. On desktop, Recharts provides:

- Interactive tooltips (hover to see exact price/date)
- Responsive sizing
- Legend support
- Smooth curves
- Better accessibility
- Less code to maintain

### Why React Router instead of file-based routing?

Tauri + Vite doesn't have a built-in file-based router like Expo Router. React Router v7 is the standard for React SPAs. We use a simple route config:

```typescript
const routes = [
  { path: "/", element: <Home /> },
  { path: "/watchlist", element: <Watchlist /> },
  { path: "/product/:id", element: <ProductDetail /> },
  { path: "/compare/:id", element: <Compare /> },
  { path: "/alerts", element: <Alerts /> },
  { path: "/settings", element: <Settings /> },
];
```

---

## Keyboard Shortcuts

| Shortcut         | Action                                                          |
| ---------------- | --------------------------------------------------------------- |
| Cmd/Ctrl+K       | Open search                                                     |
| Cmd/Ctrl+N       | New alert (on product detail)                                   |
| Cmd/Ctrl+E       | Export watchlist                                                |
| Cmd/Ctrl+I       | Import watchlist                                                |
| Cmd/Ctrl+,       | Open settings                                                   |
| Cmd/Ctrl+Shift+T | Toggle theme                                                    |
| Cmd/Ctrl+R       | Refresh data                                                    |
| Escape           | Close modal/overlay                                             |
| Cmd/Ctrl+1-6     | Navigate to tab (Home/Watchlist/Alerts/Compare/Search/Settings) |

---

## Workspace Setup

**Root `pnpm-workspace.yaml`:**

```yaml
packages:
  - "desktop"
```

**Root `package.json` additions:**

```json
{
  "scripts": {
    "dev:desktop": "pnpm --filter desktop dev",
    "build:desktop": "pnpm --filter desktop build"
  }
}
```

**Desktop `package.json`:**

```json
{
  "name": "desktop",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && tauri build",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "recharts": "^2.15.0",
    "lucide-react": "^0.400.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.9.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "@testing-library/react": "^16.0.0",
    "vitest": "^3.0.0"
  }
}
```

---

## Implementation Order

1. **Phase 1: Scaffold** — Create `desktop/` with Tauri + Vite + React + Tailwind. Verify it builds and runs.
2. **Phase 2: Storage adapter** — Refactor `lib/storage.ts` to use `StorageAdapter` pattern. Mobile stays backward-compatible. Desktop gets `localStorage` adapter.
3. **Phase 3: Core screens** — Home, Watchlist, Product Detail with shared lib/ logic.
4. **Phase 4: Compare + Charts** — Compare screen with Recharts multi-line chart.
5. **Phase 5: Alerts + Reminders** — Full alerts/reminders with notification integration.
6. **Phase 6: Search + Settings** — Search modal, settings page, theme toggle.
7. **Phase 7: Desktop features** — System tray, background polling, file import/export, menu bar, keyboard shortcuts.
8. **Phase 8: Polish** — Responsive layout, transitions, error states, empty states.

---

## Error Handling and Edge Cases

| Scenario                                            | Behavior                                                         |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| localStorage cleared externally                     | App shows empty state, prompts to import or re-add products      |
| Import file is malformed JSON/CSV                   | Show error toast: "Invalid file format. Expected JSON or CSV."   |
| Import file has unknown product IDs                 | Skip unknown entries, report count in summary toast              |
| Export write fails (permission denied, disk full)   | Show error toast with reason, no data loss                       |
| Background poller permission denied                 | Log warning, disable auto-poll, notify user once                 |
| Price drop detected while app is closed             | Notification queued by OS; alert marked triggered when app opens |
| Multiple alerts on same product fire simultaneously | Each alert fires independently, no dedup                         |
| localStorage 5MB limit exceeded                     | Show warning: "Storage nearly full. Export and delete old data." |

---

## Performance Considerations

- **localStorage limits**: ~5MB. Typical watchlist with 20 products, 10 distributors each, 90 days of price history ≈ 2-3MB. Sufficient for v1. If users hit limits, suggest export + prune.
- **Recharts vs hand-rolled SVG**: Recharts is heavier but provides interactive tooltips, legends, responsive sizing. For our data volume (<100 data points per chart), performance is fine. If slow on older machines, can fall back to hand-rolled SVG.
- **Vite tree-shaking**: Only import the lib/ functions each page needs. Don't import the entire lib/ bundle.
- **Background poller**: Runs in Rust (not JS), so no main-thread blocking. Tauri's IPC is async, non-blocking.

---

## Testing Strategy

- **Unit tests**: Pure TS logic (currency, storage adapter, catalog search) — same vitest setup as mobile
- **Component tests**: React components with `@testing-library/react`
- **Integration tests**: Tauri commands via `@tauri-apps/api` mock
- **E2E**: Tauri's built-in WebDriver support (later)

---

## Risks and Mitigations

| Risk                             | Mitigation                                                           |
| -------------------------------- | -------------------------------------------------------------------- |
| lib/ refactor breaks mobile      | StorageAdapter factory preserves backward-compatible default export  |
| Tauri 2 is newer/less stable     | Use Tauri 2 stable (released). Community is large, docs are good     |
| NativeWind in Tauri webview      | NativeWind 4 works in browsers. If issues, fall back to raw Tailwind |
| Background polling battery drain | User-configurable interval, default 15 min, can set to manual        |
| Large lib/ import size           | Only import what's needed. Vite tree-shakes effectively              |
