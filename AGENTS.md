# AGENTS.md — Product Stock Finder

Guidance for AI coding agents working in this repository. Read this before touching any code.

## Project Overview

**Product Stock Finder** (formerly "Stock Tracker Pro") is an Expo/React Native mobile + web app for tracking product availability and prices across 50+ global electronics distributors (MikroTik, Ubiquiti networking gear focus). Users maintain a watchlist, set price alerts, schedule back-order reminders, watch for restocks, and compare price history across distributors.

- **App name in UI:** "Product Stock Finder" (see git log — was renamed from "Stock Tracker Pro"; do not revert)
- **Bundle ID:** `com.app.stock_tracker_pro`
- **Platform targets:** iOS, Android, Web (Expo web)
- **State:** Local-only via AsyncStorage. No live scraping — listings are seeded from `lib/sample-data.ts` and `app/_layout.tsx`. The backend (server/, drizzle/) is scaffolded but unused by the app's current feature set.

## Tech Stack

| Layer              | Tech                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Expo SDK 54, React Native 0.81, React 19, Expo Router 6 (typed routes, react compiler enabled)                                          |
| Language           | TypeScript 5.9 (strict)                                                                                                                 |
| Styling            | NativeWind 4 (Tailwind) + inline styles. Theme tokens in `theme.config.js`, surfaced via `lib/_core/theme.ts` and `hooks/use-colors.ts` |
| State              | AsyncStorage (`lib/storage.ts`), React Query + tRPC client wired but only `system`/`auth` routers exist server-side                     |
| Notifications      | expo-notifications (local), expo-background-task for price-drop polling                                                                 |
| Charts             | react-native-svg (hand-rolled SVG polylines — no chart library)                                                                         |
| Backend (scaffold) | Express + tRPC v11 + Drizzle (MySQL) + Manus OAuth. See `server/README.md`. Currently unused by app features.                           |
| Package manager    | pnpm (via corepack; `packageManager: pnpm@9.12.0`). Node linker hoisted (`.npmrc`).                                                     |

## Commands

```bash
pnpm dev          # concurrently runs API server (tsx watch) + Metro (expo start --web --port 8081)
pnpm dev:server   # backend only
pnpm dev:metro    # metro/web only
pnpm check        # tsc --noEmit  (typecheck — run before claiming done)
pnpm lint         # expo lint (ESLint flat config, eslint-config-expo)
pnpm format       # prettier --write .
pnpm test         # vitest run
pnpm db:push      # drizzle-kit generate && migrate (requires DATABASE_URL)
pnpm build        # esbuild bundle server to dist/
pnpm start        # production node server
pnpm android      # expo start --android
pnpm ios          # expo start --ios
pnpm qr           # generate dev QR code
```

**Always run `pnpm check` and `pnpm lint` after non-trivial changes.** The project keeps TypeScript at 0 errors (see checkpoint commit messages).

## Directory Layout

```
app/                    Expo Router routes (file-based)
  _layout.tsx           Root layout — seeds CRS804 + CRS326 on first launch, sets up
                        notifications, background price-check task, tRPC/QueryClient
  (tabs)/               Bottom-tab screens: index (Home), watchlist, alerts, settings
  product/[id].tsx      Product detail (largest screen — ~1187 lines)
  compare/[id].tsx      Multi-distributor price history comparison chart
  search.tsx            Add-product search
  oauth/callback.tsx    Manus OAuth callback (backend auth flow)
  dev/theme-lab.tsx     Theme dev playground
components/             Reusable UI (PriceSparkline, ScreenContainer, HapticTab, IconSymbol)
components/ui/          IconSymbol (iOS .ios.tsx + cross-platform .tsx with Android/web mappings)
lib/                   App logic
  types.ts             Core domain types (Product, DistributorListing, PriceAlert, etc.)
  storage.ts           AsyncStorage CRUD (watchlist, alerts, reminders, stock watches, settings)
  distributors.ts      Static distributor database (30+ entries)
  catalog.ts           Pre-loaded product catalog
  sample-data.ts        Seeded 10-point 90-day price history per distributor (CRS804, CRS326)
  currency.ts          Static exchange rates, convertPrice, formatPrice, getBestPrice
  notifications.ts     expo-notifications helpers (stock/price/back-order/test)
  background-price-check.ts   TaskManager + expo-background-task price-drop polling
  theme-provider.tsx   NativeWind + Appearance theme provider
  trpc.ts              tRPC React client setup
  _core/               Framework-level (manus-runtime, auth, api, theme) — avoid editing
hooks/                 use-auth, use-colors, use-color-scheme, use-alert-badge
constants/             const.ts, oauth.ts, theme.ts (re-exports)
server/                Express + tRPC backend (scaffolded, see server/README.md)
  _core/               Framework backend code — do not modify unless extending infra
  routers.ts           App router — currently only system + auth
  db.ts, storage.ts    DB/S3 helpers
drizzle/              MySQL schema (users table only so far)
shared/               Cross-platform types/consts; shared/_core/ — don't modify
tests/                vitest (only auth.logout.test.ts, currently .skip)
scripts/              load-env.js, generate_qr.mjs, reset-project.js
references/           periodic-updates.md (reference docs)
design.md             Full UI/UX design spec
todo.md               Phase-by-phase feature checklist (read for history/context)
theme.config.js       Brand color tokens (sapphire blue + emerald green)
app.config.ts         Expo config (branding, plugins, intent filters)
```

### `_core/` directories — hands off

Anything under `lib/_core/`, `server/_core/`, or `shared/_core/` is framework-level. Do not edit unless explicitly extending infrastructure. The app's own code lives in `lib/`, `app/`, `components/`, `hooks/`.

## Domain Model (lib/types.ts)

- `StockStatus`: `"in_stock" | "back_order" | "out_of_stock" | "unknown"`
- `Product` has many `DistributorListing`s; each listing has a `priceHistory: PricePoint[]`
- `PriceAlert` — target price threshold, deactivates on trigger, stores `triggeredAt`/`triggeredPrice`
- `BackOrderReminder` — reused for both date-based reminders and back-in-stock watches (discriminated by `reminderType`)
- `AppSettings` — theme, displayCurrency (USD/EUR/GBP/MYR/AUD/NZD/CAD/ZAR/THB/SGD/HKD/AED), checkInterval, notification toggles

## AsyncStorage Keys (lib/storage.ts)

`watchlist_products`, `price_alerts`, `app_settings`, `back_order_reminders`, `back_in_stock_watches`. Also legacy keys cleared by `clearAllData`: `recently_viewed`, `distributor_watches`, `triggered_alert_history`, `product_notes`, `has_seen_onboarding`.

## Conventions

- **Path aliases:** `@/*` → repo root, `@shared/*` → `shared/`. Prefer `@/lib/...`, `@/components/...`, `@/hooks/...`.
- **Styling:** Use NativeWind classes (`className="..."`) for layout where possible; inline `style={{}}` for dynamic/theme-driven colors via `useColors()`. Theme color tokens: `primary, background, surface, foreground, muted, border, success, warning, error, card, tint`.
- **Colors:** Never hardcode brand colors in components. Pull from `useColors()` (returns current scheme palette) or `constants/theme.ts`.
- **Icons:** Use `<IconSymbol name="..." />`. iOS uses SF Symbols; Android/web maps to Material names in `components/ui/icon-symbol.tsx`. If you add a new icon name, add the Android/web mapping too.
- **Haptics:** `expo-haptics` is used for tap feedback (`Haptics.impactAsync`) and notifications (`notificationAsync`). Follow existing patterns on tappable elements.
- **Notifications:** All notification scheduling must guard `Platform.OS === "web"` (return early). See `lib/notifications.ts`.
- **Background tasks:** `TaskManager.defineTask` must be called at module-level (global scope), not inside a component — see `lib/background-price-check.ts`.
- **Seeding:** CRS804 and CRS326 are auto-seeded into the watchlist on first launch in `app/_layout.tsx`. Keep seed listings in sync with `lib/sample-data.ts` when adding price history.
- **Currency:** Prices are stored in their native currency; convert via `convertPrice(amount, from, to)` using static rates in `lib/currency.ts`. `getBestPrice` returns the cheapest non-out-of-stock listing in a target currency.
- **No comments** unless explaining non-obvious logic. Existing code uses `// ─── Section ───` banners in storage/notifications — match that style for section dividers.
- **Commit style:** Checkpoint commits follow `Checkpoint: vX.Y: <features>. TypeScript: 0 errors.` — match this when committing.
- **Tests:** vitest. Only one test exists (auth.logout, currently `.skip`). Add tests under `tests/` mirroring `*.test.ts`.

## Brand / Theme (theme.config.js)

- Primary (Sapphire Blue): `#0F52BA` light / `#3B7DD8` dark
- Success (Emerald): `#00C896`
- Warning (Amber): `#F59E0B` / `#FBBF24`
- Error (Red): `#EF4444` / `#F87171`
- Background: `#F8FAFC` light / `#0A0E1A` dark
- Surface: `#FFFFFF` / `#131929`

## Key Flows

1. **Add product:** Search (`app/search.tsx`) → tap result → `addToWatchlist` → back to watchlist.
2. **View detail:** Watchlist card → `product/[id]` → distributor rows, best-distributor card, sparklines, set alert, remind me, watch for restock, compare button.
3. **Compare:** Product Detail → `compare/[id]` → multi-line SVG chart with 1W/1M/3M/All filters, cheapest-region card, cross-distributor alert CTA.
4. **Alerts:** `(tabs)/alerts.tsx` has two tabs: Alerts (price alerts + price-drop history with re-arm) and Reminders (date reminders + stock watches with reschedule).
5. **Price-drop detection:** Background task (`PRICE_CHECK_TASK`, 15-min min interval) + foreground `checkPriceDropsNow()` on app launch. Compares best in-stock price (converted to alert currency) against target; fires notification and deactivates alert.

## Environment

- No `.env` committed. Backend needs `DATABASE_URL`, `EXPO_PUBLIC_OAUTH_*`, `EXPO_PUBLIC_API_BASE_URL` for full functionality. App works without these (local-only mode).
- `scripts/load-env.js` loads env with system > `.env` priority.

## Before You Commit

1. `pnpm check` — must pass with 0 TypeScript errors
2. `pnpm lint` — must pass
3. `pnpm test` — run if you touched server/ or shared/
4. Do not commit `.env*`, `node_modules/`, `dist/`, `.expo/`, `ios/`, `android/` (all in `.gitignore`)
5. Match the existing checkpoint commit message style if the user asks for a checkpoint

## Reference Docs

- `design.md` — full UI/UX design spec (screen list, flows, component design, distributor catalog)
- `todo.md` — phase-by-phase feature history (14 phases, all checked off)
- `server/README.md` — backend guide (auth, DB, tRPC, storage, LLM, image gen) — read only if adding backend features
- `references/periodic-updates.md` — reference doc on periodic updates
